import db from '../db/index.js';
import redis from '../db/redis.js';
import config from '../config/index.js';
import notificationService from './notificationService.js';
import stateMachine from './transactionStateMachine.js';
import payoutSettingsService from './payoutSettingsService.js';
import { getTraderUsdcTrustlineStatus, assertTraderCanReceiveUsdc } from './traderStellarService.js';
import { fiatToUgx } from '../utils/financial.js';
import logger from '../utils/logger.js';

// Will be set by websocket module after init
let io = null;

// Will be lazy-loaded to avoid circular dependency
let jobQueueModule = null;
async function getJobQueue() {
  if (!jobQueueModule) {
    jobQueueModule = (await import('./jobQueue.js')).default;
  }
  return jobQueueModule;
}

/**
 * Inject the Socket.io server instance.
 * Called once during app bootstrap.
 */
function setIo(socketIo) {
  io = socketIo;
}

/**
 * Select the best available OTC trader and push the request to them.
 *
 * [C3]  Atomic UPDATE with state guard prevents double-assignment.
 * [C5]  Filters by mobile money network.
 * [C6]  Enqueues refund via Bull when no trader is available.
 * [P2]  Uses trader `status = 'ACTIVE'` instead of is_active/is_suspended.
 *
 * Selection criteria (in order):
 *   1. status = 'ACTIVE'
 *   2. Supports the required mobile money network
 *   3. Has enough USDC float for this transaction
 *   4. Under daily limit
 *   5. Highest trust score
 *   6. Lowest current load (fewest active in-progress requests)
 */
async function matchTrader(transactionId) {
  // ── C3 FIX: Redis lock prevents concurrent matching for same tx ──
  const lockKey = `lock:match:${transactionId}`;
  // [PHASE 4] Use config-driven lock TTL for trader matching
  const lockAcquired = await redis.set(lockKey, '1', 'EX', config.platform.redisLockTtlMatchSeconds, 'NX');
  if (!lockAcquired) {
    logger.warn(`[Matching] Lock held for tx ${transactionId} — skipping duplicate match attempt`);
    return null;
  }

  try {
    const txResult = await db.query(
      `SELECT * FROM transactions WHERE id = $1`,
      [transactionId]
    );
    const transaction = txResult.rows[0];
    if (!transaction) throw new Error(`Transaction ${transactionId} not found`);

    // Guard: accept both ESCROW_LOCKED (old flow) and TRADER_MATCHED (new flow with early state transition)
    if (!['ESCROW_LOCKED', 'TRADER_MATCHED'].includes(transaction.state)) {
      logger.warn(`[Matching] Tx ${transactionId} in state ${transaction.state}, expected ESCROW_LOCKED or TRADER_MATCHED — skipping`);
      return null;
    }

    // Skip if already assigned to a trader
    if (transaction.trader_id && transaction.state === 'TRADER_MATCHED') {
      logger.info(`[Matching] Tx ${transactionId} already assigned to trader ${transaction.trader_id}`);
      return { id: transaction.trader_id };
    }

    const fiatNeeded = parseFloat(transaction.fiat_amount || 0);
    const fiatCurrency = transaction.fiat_currency || 'UGX';
    if (!Number.isFinite(fiatNeeded) || fiatNeeded <= 0) {
      logger.error(`[Matching] Tx ${transactionId} has invalid fiat_amount ${transaction.fiat_amount} — cannot match`);
      return null;
    }

    // [PHASE 2A] Daily-limit guard uses the UGX ledger (daily_volume / daily_limit_ugx
    // are denominated in UGX, so converting fiat→UGX HERE is correct — this is NOT
    // the legacy float unit bug). Canonical FLOAT now lives in trader_payout_settings
    // and is reserved/finalized in the payout setting's OWN currency.
    const fiatAmountUgx = fiatToUgx(fiatNeeded, fiatCurrency);

    let excludedTraderIds = [];
    try {
      excludedTraderIds = await redis.smembers(`excluded-traders:${transactionId}`);
    } catch (_) { /* best-effort */ }
    const triedTraderIds = [...excludedTraderIds];
    for (let attempt = 0; attempt < 6; attempt++) {
      // ── [PHASE 2A] Canonical candidate selection from trader_payout_settings ──
      //   • trader ACTIVE + VERIFIED + has stellar_address (can actually receive USDC)
      //   • payout setting ACTIVE, matching network + currency
      //   • fiat within [min_amount, max_amount]
      //   • (available_float - reserved_float) >= fiat   (native currency — no unit mixing)
      //   • under daily UGX limit
      const candidateResult = await db.query(
        `SELECT t.id AS trader_id, t.name AS trader_name, t.stellar_address,
                ps.id AS payout_setting_id, ps.available_float, ps.reserved_float,
                (SELECT COUNT(*) FROM transactions tx
                   WHERE tx.trader_id = t.id
                     AND tx.state IN ('TRADER_MATCHED','FIAT_PAYOUT_SUBMITTED','USER_CONFIRMATION_PENDING')) AS active_load
         FROM traders t
         JOIN trader_payout_settings ps ON ps.trader_id = t.id
         WHERE t.status = 'ACTIVE'
           AND t.verification_status = 'VERIFIED'
           AND t.stellar_address IS NOT NULL
           AND ps.is_active = TRUE
           AND ps.network = $1::mobile_network
           AND ps.currency = $2
           AND $3 BETWEEN ps.min_amount AND ps.max_amount
           AND (ps.available_float - ps.reserved_float) >= $3
           AND (t.daily_volume + $4) <= t.daily_limit_ugx
           AND t.id <> ALL($5::uuid[])
         ORDER BY t.trust_score DESC, active_load ASC
         LIMIT 1`,
        [transaction.network, fiatCurrency, fiatNeeded, fiatAmountUgx, triedTraderIds]
      );

      const candidate = candidateResult.rows[0];
      if (!candidate) {
        // Permanent failure: amount outside any trader's min/max — refund instead of retry loop
        const limitsResult = await db.query(
          `SELECT MIN(min_amount) AS min_fiat, MAX(max_amount) AS max_fiat
           FROM trader_payout_settings ps
           JOIN traders t ON t.id = ps.trader_id
           WHERE ps.network = $1::mobile_network AND ps.currency = $2
             AND ps.is_active = TRUE AND t.status = 'ACTIVE'
             AND t.verification_status = 'VERIFIED'`,
          [transaction.network, fiatCurrency]
        );
        const { min_fiat: minFiat, max_fiat: maxFiat } = limitsResult.rows[0] || {};
        if (maxFiat != null && fiatNeeded > parseFloat(maxFiat)) {
          logger.error(`[Matching] Tx ${transactionId} fiat ${fiatNeeded} exceeds network max ${maxFiat} — refunding`);
          const escrowController = (await import('./escrowController.js')).default;
          await escrowController.refundOrphanTransaction(
            transactionId,
            `Amount ${fiatNeeded} ${fiatCurrency} exceeds maximum payout (${maxFiat})`
          );
          return null;
        }
        if (minFiat != null && fiatNeeded < parseFloat(minFiat)) {
          logger.error(`[Matching] Tx ${transactionId} fiat ${fiatNeeded} below network min ${minFiat} — refunding`);
          const escrowController = (await import('./escrowController.js')).default;
          await escrowController.refundOrphanTransaction(
            transactionId,
            `Amount ${fiatNeeded} ${fiatCurrency} below minimum payout (${minFiat})`
          );
          return null;
        }

        logger.warn(`[Matching] No eligible trader/payout-setting for tx ${transactionId} (${transaction.network}/${fiatCurrency} amount ${fiatNeeded}) — enqueue retry`);
        const jobQueue = await getJobQueue();
        await jobQueue.enqueueReMatch(transactionId, null, config.platform.traderRetryDelaySeconds || 30);
        return null;
      }

      const trustStatus = await getTraderUsdcTrustlineStatus(candidate.stellar_address);
      if (!trustStatus.hasTrustline) {
        logger.warn(
          `[Matching] Skipping trader ${candidate.trader_id} (${candidate.trader_name}) — ` +
          `no USDC trustline (${trustStatus.reason || 'unknown'})`
        );
        triedTraderIds.push(candidate.trader_id);
        continue;
      }

      // ── Atomically assign trader + payout_setting_id (state guarded) ──
      // Re-read current state — it can advance between loop iterations.
      const stRes = await db.query(`SELECT state, trader_id FROM transactions WHERE id = $1`, [transactionId]);
      const cur = stRes.rows[0];
      if (!cur) return null;

      let assigned = null;
      if (cur.state === 'ESCROW_LOCKED') {
        assigned = await stateMachine.transition(transactionId, 'ESCROW_LOCKED', 'TRADER_MATCHED', {
          trader_id: candidate.trader_id,
          payout_setting_id: candidate.payout_setting_id,
        });
      } else if (cur.state === 'TRADER_MATCHED' && !cur.trader_id) {
        const upd = await db.query(
          `UPDATE transactions
           SET trader_id = $1, payout_setting_id = $2, trader_matched_at = NOW(), updated_at = NOW()
           WHERE id = $3 AND trader_id IS NULL AND state = 'TRADER_MATCHED'
           RETURNING *`,
          [candidate.trader_id, candidate.payout_setting_id, transactionId]
        );
        assigned = upd.rows[0] || null;
      } else {
        logger.warn(`[Matching] Tx ${transactionId} advanced to ${cur.state} during matching — stopping`);
        return null;
      }

      if (!assigned) {
        logger.warn(`[Matching] Atomic assign failed for tx ${transactionId} — already advanced`);
        return null;
      }

      // ── [PHASE 2A] Reserve float on the payout setting (atomic, no overbooking) ──
      // reserveFloat increments reserved_float ONLY when (available - reserved) >= amount,
      // in a single guarded UPDATE, so concurrent matches can never overbook.
      try {
        const reserved = await payoutSettingsService.reserveFloat(candidate.payout_setting_id, fiatNeeded);
        logger.info(`[Matching] Matched tx ${transactionId} → trader ${candidate.trader_id} (${candidate.trader_name}); reserved ${fiatNeeded} ${fiatCurrency} on setting ${candidate.payout_setting_id} (reserved_float now ${reserved.reserved_float})`);
      } catch (reserveErr) {
        // Lost the float race (another tx reserved first). Unassign (keep TRADER_MATCHED,
        // clear trader_id + payout_setting_id) and try the next eligible trader.
        logger.warn(`[Matching] Reservation failed for trader ${candidate.trader_id} on tx ${transactionId}: ${reserveErr.message} — trying next`);
        await db.query(
          `UPDATE transactions SET trader_id = NULL, payout_setting_id = NULL
           WHERE id = $1 AND trader_id = $2`,
          [transactionId, candidate.trader_id]
        );
        triedTraderIds.push(candidate.trader_id);
        continue;
      }

      const trader = { id: candidate.trader_id, name: candidate.trader_name };

      // ── [L-3 FIX] Notify user that a trader has been matched ──
      notificationService.notifyUser(transaction.user_id, 'trader_matched', {
        transactionId: transaction.id,
        state: 'TRADER_MATCHED',
        message: 'A trader has been matched to your request. Mobile money payout coming soon.',
      });

      // Notify trader via notification service
      const acceptTimeoutMs = (config.platform.traderAcceptTimeoutSeconds || 180) * 1000;
      await notificationService.notifyTraderNewRequest(trader.id, {
        id: transaction.id,
        transactionId: transaction.id,
        xlm_amount: transaction.xlm_amount,
        usdc_amount: transaction.usdc_amount,
        usdcAmount: transaction.usdc_amount,
        fiat_amount: transaction.fiat_amount,
        fiatAmount: transaction.fiat_amount,
        fiat_currency: transaction.fiat_currency,
        fiatCurrency: transaction.fiat_currency,
        network: transaction.network,
        state: 'TRADER_MATCHED',
        accept_deadline: new Date(Date.now() + acceptTimeoutMs).toISOString(),
        expires_at: new Date(Date.now() + acceptTimeoutMs).toISOString(),
        expires_in: config.platform.traderAcceptTimeoutSeconds,
        expiresIn: config.platform.traderAcceptTimeoutSeconds,
        phoneHash: transaction.phone_hash,
        timestamp: new Date().toISOString(),
      });
      logger.info(`[Matching] Pushed request to trader ${trader.id} via NotificationService`);

      // ── P1 FIX: Schedule re-match via Bull delayed job instead of setTimeout ──
      const jobQueue = await getJobQueue();
      await jobQueue.enqueueReMatch(transactionId, trader.id, config.platform.traderAcceptTimeoutSeconds);

      return trader;
    }

    logger.warn(`[Matching] Exhausted match attempts for tx ${transactionId} — enqueue retry`);
    const jq = await getJobQueue();
    await jq.enqueueReMatch(transactionId, null, config.platform.traderRetryDelaySeconds || 30);
    return null;
  } finally {
    // Release lock after a short delay to prevent rapid re-entry
    // [PHASE 4] Use config-driven cleanup delay
    setTimeout(() => redis.del(lockKey), config.platform.redisLockCleanupDelayMs);
  }
}

/**
 * Handle trader accepting a request.
 *
 * [B1 FIX] Records acceptance with a timestamp so re-match timeout
 * can distinguish "matched but not accepted" from "accepted and working".
 */
async function acceptRequest(transactionId, traderId) {
  // ── B1 FIX: Set fiat_sent_at-adjacent timestamp to record acceptance ──
  // We use matched_at to record the acceptance time (trader_matched_at = assigned time)
  
  // Debug: First check current state of request
  const checkBefore = await db.query(
    `SELECT id, trader_id, state, matched_at FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const beforeState = checkBefore.rows[0];
  logger.info(`[Accept] Before accept: id=${transactionId}, trader_id=${beforeState?.trader_id}, state=${beforeState?.state}, matched_at=${beforeState?.matched_at}`);
  
  // Check if already in a completed state (FIAT_SENT, COMPLETED, etc.)
  if (beforeState && !['TRADER_MATCHED'].includes(beforeState.state)) {
    logger.warn(`[Accept] Request already progressed to ${beforeState.state} state — cannot accept`);
    const err = new Error(`Request already progressed to ${beforeState.state} state`);
    err.statusCode = 410; // 410 Gone — request has moved on
    throw err;
  }

  if (!beforeState?.matched_at) {
    const traderRes = await db.query(
      `SELECT stellar_address FROM traders WHERE id = $1`,
      [traderId]
    );
    await assertTraderCanReceiveUsdc(traderRes.rows[0]?.stellar_address);
  }
  
  const result = await db.query(
    `UPDATE transactions
     SET matched_at = NOW()
     WHERE id = $1 AND trader_id = $2 AND state = 'TRADER_MATCHED' AND matched_at IS NULL
     RETURNING *`,
    [transactionId, traderId]
  );

  let transaction = result.rows[0];
  
  if (!transaction) {
    // Update failed - check if already accepted (matched_at is not NULL)
    const alreadyAcceptedResult = await db.query(
      `SELECT id, trader_id, state, matched_at FROM transactions 
       WHERE id = $1 AND trader_id = $2 AND state = 'TRADER_MATCHED' AND matched_at IS NOT NULL`,
      [transactionId, traderId]
    );
    
    if (alreadyAcceptedResult.rows.length > 0) {
      // Already accepted - this is idempotent, return success
      logger.info(`[Accept] ✅ Request ${transactionId} already accepted at ${alreadyAcceptedResult.rows[0].matched_at}`);
      const fullResult = await db.query(
        `SELECT * FROM transactions WHERE id = $1`,
        [transactionId]
      );
      transaction = fullResult.rows[0];
    } else {
      // Real error: request expired, state changed, or trader not assigned
      logger.warn(`[Accept] ❌ Update failed for tx ${transactionId}. Condition not met. Checked trader_id=${beforeState?.trader_id}, state=${beforeState?.state}, matched_at=${beforeState?.matched_at}`);
      const err = new Error('Request expired or already handled');
      err.statusCode = 409;
      throw err;
    }
  } else {
    logger.info(`[Accept] ✅ Accepted: matched_at set to ${transaction.matched_at}`);
    const jobQueue = await getJobQueue();
    await jobQueue.enqueuePayoutTimeout(
      transactionId,
      traderId,
      config.platform.traderConfirmTimeoutSeconds
    );
  }

  const userResult = await db.query(
    `SELECT phone_hash FROM users WHERE id = $1`,
    [transaction.user_id]
  );

  return {
    transactionId: transaction.id,
    fiatAmount: transaction.fiat_amount,
    fiatCurrency: transaction.fiat_currency,
    network: transaction.network,
    phoneHash: userResult.rows[0]?.phone_hash,
    confirmDeadlineSeconds: config.platform.traderConfirmTimeoutSeconds,
  };
}

/**
 * DEPRECATED — legacy "trader confirms payout" that immediately released escrow
 * via the obsolete FIAT_SENT state.
 *
 * The canonical flow is now: submitPayoutSent (FIAT_PAYOUT_SUBMITTED) → user
 * confirms receipt → escrow release. This function no longer writes any state
 * and exists only to return a clear deprecation error to any stale caller.
 */
async function confirmPayout() {
  const err = new Error(
    'This endpoint is deprecated. Submit the mobile money reference via /requests/:id/payout-sent; USDC is released after the user confirms receipt.'
  );
  err.statusCode = 410;
  throw err;
}

/**
 * Trader submits payout sent with mobile money reference.
 * Sets state to FIAT_PAYOUT_SUBMITTED, awaiting user confirmation.
 * Does NOT release USDC yet.
 *
 * [PHASE 8] User must confirm receipt before USDC is released.
 */
async function submitPayoutSent(transactionId, traderId, payoutReference) {
  // [F-2 FIX] Verify trader authorization BEFORE state transition
  const txCheck = await db.query(
    `SELECT id, trader_id, state FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const tx = txCheck.rows[0];
  
  if (!tx) {
    logger.error(`[submitPayoutSent] Transaction ${transactionId} not found`);
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }
  
  if (tx.state !== 'TRADER_MATCHED') {
    logger.error(`[submitPayoutSent] Transaction ${transactionId} in unexpected state: ${tx.state} (expected TRADER_MATCHED)`);
    // [B1 FIX] Invalid-state action is a client conflict (409), not a 500. This also
    // covers re-submitting a payout on a transaction already in DISPUTE_OPENED.
    const err = new Error(`Cannot submit payout — transaction is in state ${tx.state}, expected TRADER_MATCHED`);
    err.statusCode = 409;
    throw err;
  }
  
  if (tx.trader_id !== traderId) {
    logger.error(`[submitPayoutSent] Trader ${traderId} not authorized for tx ${transactionId}`);
    const err = new Error('Cannot submit payout — transaction not assigned to this trader');
    err.statusCode = 403;
    throw err;
  }

  logger.info(`[submitPayoutSent] Starting transition for tx ${transactionId}: TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED`);
  
  const transaction = await stateMachine.transition(
    transactionId,
    'TRADER_MATCHED',
    'FIAT_PAYOUT_SUBMITTED',
    { payout_reference: payoutReference }
  );
  
  if (!transaction) {
    logger.error(`[submitPayoutSent] State transition FAILED for tx ${transactionId} — concurrent modification or state mismatch`);
    const err = new Error('Cannot submit payout — state transition failed (concurrent modification)');
    err.statusCode = 409;
    throw err;
  }

  logger.info(`[submitPayoutSent] ✅ Trader ${traderId} submitted payout for tx ${transactionId}, state now: ${transaction.state}`);

  // Notify user that trader marked payment sent
  notificationService.notifyUser(transaction.user_id, 'trader_sent_payout', {
    transactionId: transaction.id,
    state: 'FIAT_PAYOUT_SUBMITTED',
    fiat_amount: transaction.fiat_amount,
    fiat_currency: transaction.fiat_currency,
    message: 'Trader marked payment as sent. Please confirm receipt.',
  });

  return transaction;
}

export default {
  setIo,
  matchTrader,
  acceptRequest,
  confirmPayout,
  submitPayoutSent,
};
