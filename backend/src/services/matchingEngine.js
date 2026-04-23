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
          WHERE tx.trader_id = t.id AND tx.state IN ('TRADER_MATCHED','FIAT_SENT')) as active_load
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
      // Float was insufficient (race condition) — roll back the assignment
      logger.warn(`[Matching] Float decrement failed for trader ${trader.id} — rolling back assignment`);
      // [F-5 FIX] Route rollback through state machine for audit trail
      await stateMachine.transition(transactionId, 'TRADER_MATCHED', 'ESCROW_LOCKED', {
        trader_id: null,
        trader_matched_at: null,
      });
      // Retry matching (will pick next best trader)
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
    await notificationService.notifyTraderNewRequest(trader.id, {
      transactionId: transaction.id,
      usdcAmount: transaction.usdc_amount,
      fiatAmount: transaction.fiat_amount,
      fiatCurrency: transaction.fiat_currency,
      network: transaction.network,
      phoneHash: transaction.phone_hash,
      expiresIn: config.platform.traderAcceptTimeoutSeconds,
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
  const result = await db.query(
    `UPDATE transactions
     SET matched_at = NOW()
     WHERE id = $1 AND trader_id = $2 AND state = 'TRADER_MATCHED' AND matched_at IS NULL
     RETURNING *`,
    [transactionId, traderId]
  );

  const transaction = result.rows[0];
  if (!transaction) throw new Error('Cannot accept — transaction not found, wrong state, or already accepted');

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
 * Handle trader confirming payout sent.
 * Moves state to FIAT_SENT — escrow release handled by the caller.
 */
async function confirmPayout(transactionId, traderId) {
  // [F-2 FIX] Verify trader authorization BEFORE state transition to prevent state corruption
  const txCheck = await db.query(
    `SELECT trader_id FROM transactions WHERE id = $1 AND state = 'TRADER_MATCHED'`,
    [transactionId]
  );
  if (!txCheck.rows[0]) throw new Error('Cannot confirm — transaction not found or wrong state');
  if (txCheck.rows[0].trader_id !== traderId) {
    throw new Error('Cannot confirm — transaction not assigned to this trader');
  }

  const transaction = await stateMachine.transition(transactionId, 'TRADER_MATCHED', 'FIAT_SENT');
  if (!transaction) throw new Error('Cannot confirm — state transition failed (concurrent modification)');

  logger.info(`[Matching] Trader ${traderId} confirmed payout for tx ${transactionId}`);

  // Notify user via notification service
  notificationService.notifyUser(transaction.user_id, 'fiat_sent', {
    transactionId: transaction.id,
    state: 'FIAT_SENT',
    message: 'Mobile money is on its way!',
  });

  return transaction;
}

export default {
  setIo,
  matchTrader,
  acceptRequest,
  confirmPayout,
};
