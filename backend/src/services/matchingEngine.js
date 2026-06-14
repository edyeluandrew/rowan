import db from '../db/index.js';
import redis from '../db/redis.js';
import config from '../config/index.js';
import notificationService from './notificationService.js';
import stateMachine from './transactionStateMachine.js';
import { fiatToUgx, getFloatColumn } from '../utils/financial.js';
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

    const fiatNeeded = parseFloat(transaction.fiat_amount || 0);

    // ── [C-1 FIX] Determine the fiat currency and float column ──
    const fiatCurrency = transaction.fiat_currency || 'UGX';
    const floatCol = getFloatColumn(fiatCurrency);

    // [F-6 FIX] Convert fiat amount to UGX equivalent using shared helper
    const fiatAmountUgx = fiatToUgx(fiatNeeded, fiatCurrency);

    // ── C5 FIX: Filter by network + P2 FIX: Use status enum ──
    // [C-1 FIX] Compare daily_volume (UGX) + fiat-in-UGX against daily_limit_ugx
    // [C-2 FIX] Only match traders whose float_{currency} >= fiatAmountUgx (not fiatNeeded!)
    // [VERIFICATION GUARD] Only match VERIFIED traders
    const traderResult = await db.query(
      `SELECT t.*,
         (SELECT COUNT(*) FROM transactions tx
          WHERE tx.trader_id = t.id AND tx.state IN ('TRADER_MATCHED','FIAT_PAYOUT_SUBMITTED','USER_CONFIRMATION_PENDING')) as active_load
       FROM traders t
       WHERE t.status = 'ACTIVE'
         AND t.verification_status = 'VERIFIED'
         AND $1 = ANY(t.networks)
         AND t.${floatCol} >= $2
         AND (t.daily_volume + $3) <= t.daily_limit_ugx
       ORDER BY t.trust_score DESC, active_load ASC
       LIMIT 1`,
      [transaction.network, fiatAmountUgx, fiatAmountUgx]
    );

    const trader = traderResult.rows[0];

    if (!trader) {
      logger.warn(`[Matching] No available trader for tx ${transactionId} — will retry via job queue`);
      // Don't fail immediately — enqueue for retry and let the job queue retry later
      const jobQueue = await getJobQueue();
      await jobQueue.enqueueReMatch(transactionId, null, config.platform.traderRetryDelaySeconds || 30);
      logger.info(`[Matching] Enqueued retry for tx ${transactionId} in 30 seconds`);
      return null;
    }

    // ── C3 FIX: Atomic state transition prevents double-assignment ──
    // Accept both ESCROW_LOCKED (old flow) and TRADER_MATCHED (new flow) as source
    let assignResult = null;
    if (transaction.state === 'ESCROW_LOCKED') {
      assignResult = await stateMachine.transition(transactionId, 'ESCROW_LOCKED', 'TRADER_MATCHED', {
        trader_id: trader.id,
      });
    } else if (transaction.state === 'TRADER_MATCHED' && !transaction.trader_id) {
      // Already in TRADER_MATCHED (early transition from escrowController), just update trader_id
      const updateResult = await db.query(
        `UPDATE transactions 
         SET trader_id = $1, trader_matched_at = NOW(), updated_at = NOW()
         WHERE id = $2 AND trader_id IS NULL AND state = 'TRADER_MATCHED'
         RETURNING *`,
        [trader.id, transactionId]
      );
      assignResult = updateResult.rows[0] || null;
    }

    if (!assignResult) {
      logger.warn(`[Matching] Atomic assign failed for tx ${transactionId} — already advanced`);
      return null;
    }

    // ── [C-2 FIX] Atomically decrement trader float after match ──
    // Use fiatAmountUgx (integer) not fiatNeeded (decimal) for BIGINT column
    const floatDecrResult = await db.query(
      `UPDATE traders SET ${floatCol} = ${floatCol} - $1
       WHERE id = $2 AND ${floatCol} >= $1
       RETURNING id`,
      [fiatAmountUgx, trader.id]
    );
    if (floatDecrResult.rows.length === 0) {
      // Float was insufficient (race condition)
      // CRITICAL: Do NOT roll back state. Once TRADER_MATCHED, transaction progresses forward only.
      // Instead, mark this match as invalid and try the next trader
      logger.warn(`[Matching] Float insufficient for trader ${trader.id} after atomic match — trying next trader`);
      
      // Clear this trader's ID from the transaction (keep TRADER_MATCHED state)
      // This allows another trader to be matched later
      await db.query(
        `UPDATE transactions SET trader_id = NULL WHERE id = $1 AND trader_id = $2`,
        [transactionId, trader.id]
      );
      
      // Retry matching (will pick next best trader, staying in TRADER_MATCHED state)
      return matchTrader(transactionId);
    }

    logger.info(`[Matching] Matched tx ${transactionId} → trader ${trader.id} (${trader.name}), decremented ${floatCol} by ${fiatNeeded}`);

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
      // Generate client-side deadline using config timeout (usually 180s)
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
