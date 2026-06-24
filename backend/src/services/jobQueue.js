import Queue from 'bull';
import config from '../config/index.js';
import db from '../db/index.js';
import websocket from '../services/websocket.js';
import notificationService from '../services/notificationService.js';
import stateMachine from './transactionStateMachine.js';
import auditLogService from './auditLogService.js';
import logger from '../utils/logger.js';

/**
 * Bull job queues for async/deferred tasks.
 * Backed by Render Key Value (Redis-compatible Valkey).
 * Migrated from Upstash to avoid request quota limits.
 */

// Parse Redis URL into an options object so Bull's internal ioredis client
// gets maxRetriesPerRequest: null (prevents crash on transient disconnects).
function parseRedisOpts(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    username: parsed.username !== 'default' ? parsed.username : undefined,
    tls: url.startsWith('rediss://') ? {} : undefined,
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    retryStrategy(times) {
      return Math.min(times * 500, 15000);
    },
  };
}

const defaultOpts = {
  redis: parseRedisOpts(config.redisUrl),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
};

// Lazy-load escrowController to avoid circular dependency
let escrowControllerModule = null;
async function getEscrowController() {
  if (!escrowControllerModule) {
    escrowControllerModule = (await import('./escrowController.js')).default;
  }
  return escrowControllerModule;
}

// ─── Queue: Refund failed/timed-out transactions ──────────
const refundQueue = new Queue('refund', defaultOpts);

refundQueue.process(async (job) => {
  const { transactionId, dispute, userId } = job.data;
  logger.info(`[Job:refund] Processing ${dispute ? 'DISPUTE ' : ''}refund for tx ${transactionId}`);

  const escrowController = await getEscrowController();
  const payoutSettingsService = await import('./payoutSettingsService.js').then(m => m.default);

  const result = await db.query(
    `SELECT t.*, u.stellar_address as user_stellar
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.id = $1`,
    [transactionId]
  );
  const tx = result.rows[0];
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  // ── [DISPUTE] User won the dispute ──────────────────────────
  // IMPORTANT (P0.7): we do NOT fake an on-chain refund here. By this point the
  // deposited XLM has already been swapped to USDC and is held in escrow, so a
  // user refund is a real money-movement decision that is not safely automated
  // yet. Marking the tx REFUNDED with a placeholder hash would falsely claim the
  // customer was paid back. Instead we:
  //   1. Release any reserved partner float (safe internal bookkeeping), and
  //   2. Leave the transaction in DISPUTE_REFUND_PENDING (a clear, non-terminal
  //      "awaiting manual settlement" state) for operations to settle.
  if (dispute) {
    // [PHASE 2A] User won: release the RESERVED float ONLY (reserved_float -= amount),
    // leaving available_float intact. Idempotent via transactions.float_settled.
    await payoutSettingsService.releaseReservationForTransaction(
      transactionId,
      tx.payout_setting_id,
      tx.fiat_amount
    );

    // [PHASE 2A / B3] Audit the refund-pending outcome — money decision.
    await auditLogService.log({
      actor_role: 'system',
      action: 'dispute_refund_pending',
      resource_type: 'transaction',
      resource_id: transactionId,
      new_value: { state: 'DISPUTE_REFUND_PENDING' },
      metadata: {
        user_id: userId,
        trader_id: tx.trader_id,
        payout_setting_id: tx.payout_setting_id,
        fiat_amount: tx.fiat_amount,
        fiat_currency: tx.fiat_currency,
      },
    });

    // [PHASE 2B] Attempt the real on-chain USDC refund to the user. refundToUser
    // is fully self-guarded + idempotent: on success it moves the tx to REFUNDED
    // and stores stellar_refund_tx; if blocked (e.g. user has no USDC trustline)
    // or the submission fails, it records refund_error and LEAVES the tx in
    // DISPUTE_REFUND_PENDING for an admin retry — it does NOT throw, so this job
    // completes cleanly rather than retry-storming a user-action-required state.
    const refundResult = await escrowController.refundToUser(transactionId, {
      adminId: null,
      retry: false,
    });

    if (refundResult.status === 'refunded') {
      logger.info(`[Job:refund] DISPUTE user-win tx ${transactionId} REFUNDED on-chain: ${refundResult.refundHash}`);
      return { status: 'dispute_resolved', action: 'refunded', refundHash: refundResult.refundHash };
    }

    logger.warn(
      `[Job:refund] DISPUTE user-win tx ${transactionId} could not auto-settle (${refundResult.status}${refundResult.code ? '/' + refundResult.code : ''}) — left in DISPUTE_REFUND_PENDING for admin retry.`
    );
    return {
      status: 'dispute_resolved',
      action: 'refund_pending',
      refundStatus: refundResult.status,
      code: refundResult.code || null,
    };
  }

  // ── [NORMAL] Orphan-safe refund with pre/post-swap branching ──
  const refundResult = await escrowController.refundOrphanTransaction(
    transactionId,
    tx.failure_reason || 'No trader available'
  );

  if (refundResult.status === 'refunded') {
    await notificationService.notifyRefund(tx.user_id, tx, tx.failure_reason || 'No trader available');
    return { refundHash: refundResult.refundHash, asset: refundResult.asset };
  }

  logger.warn(
    `[Job:refund] Tx ${transactionId} could not auto-refund (${refundResult.status}${refundResult.code ? '/' + refundResult.code : ''}) — left for admin review.`
  );
  return {
    status: refundResult.status,
    code: refundResult.code || null,
    reason: refundResult.reason || null,
  };
});

// ─── Queue: Release USDC to trader (retry on failure) ─────
// [B4 FIX] Retries escrow release with exponential backoff
const releaseQueue = new Queue('release', {
  ...defaultOpts,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

releaseQueue.process(async (job) => {
  const { transactionId, dispute, traderId } = job.data;
  logger.info(`[Job:release] Processing ${dispute ? 'DISPUTE ' : ''}USDC release for tx ${transactionId}`);

  const escrowController = await getEscrowController();

  // ── Release USDC to trader (handles float finalization + state transition internally) ──
  const releaseHash = await escrowController.releaseToTrader(transactionId);

  // A null hash means the release did NOT happen (e.g. trader missing USDC
  // trustline → tx moved to RELEASE_BLOCKED, or a concurrent lock). Do NOT report
  // success or send "resolved" notifications; throw so the job retries / surfaces.
  if (!releaseHash) {
    throw new Error(`[Job:release] Release blocked or not completed for tx ${transactionId} (no release hash). Funds remain locked; check trader trustline / tx state.`);
  }
  logger.info(`[Job:release] Release succeeded for tx ${transactionId}: ${releaseHash}`);

  // ── [DISPUTE] Notify parties on successful resolution ──
  if (dispute) {
    const txResult = await db.query(
      `SELECT user_id FROM transactions WHERE id = $1`,
      [transactionId]
    );
    const tx = txResult.rows[0];
    
    if (tx) {
      await notificationService.notifyUser(tx.user_id, 'dispute_resolved_release', {
        transactionId,
        message: 'Dispute resolved - USDC released to trader',
      });
      await notificationService.notifyTrader(traderId, 'dispute_resolved_release', {
        transactionId,
        usdcReleased: true,
      });
    }
    
    return { releaseHash, status: 'dispute_resolved' };
  }

  // ── [NORMAL] Notify both parties on successful release ──
  const txResult = await db.query(
    `SELECT * FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const tx = txResult.rows[0];
  if (tx) {
    // [SMS Integration] notify with async fallback (phone will be looked up from cache)
    await notificationService.notifyTransactionComplete(tx.user_id, tx.trader_id, tx);
  }

  return { releaseHash };
});

releaseQueue.on('failed', async (job, err) => {
  logger.error(`[Job:release] Attempt ${job.attemptsMade} failed for tx ${job.data.transactionId}:`, err.message);
  if (job.attemptsMade >= 5) {
    logger.error(`[Job:release] CRITICAL: All release attempts exhausted for tx ${job.data.transactionId}. Writing to dead_letter_jobs.`);
    // ── [M-4 FIX] Persist to dead_letter_jobs table ──
    try {
      await db.query(
        `INSERT INTO dead_letter_jobs (queue, job_data, error_message, attempts)
         VALUES ($1, $2, $3, $4)`,
        ['release', JSON.stringify(job.data), err.message, job.attemptsMade]
      );
    } catch (dlErr) {
      logger.error(`[Job:release] Failed to write dead letter:`, dlErr.message);
    }
  }
});

// ─── Queue: Re-match trader after accept timeout ──────────
// [P1 FIX] Replaces in-memory setTimeout with persistent Bull delayed job
const reMatchQueue = new Queue('rematch', {
  ...defaultOpts,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

reMatchQueue.process(async (job) => {
  const { transactionId, currentTraderId, mode = 'accept_timeout' } = job.data;

  const result = await db.query(
    `SELECT * FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const tx = result.rows[0];

  // Retry matching only — never regress state when no trader was assigned yet
  if (mode === 'retry_match') {
    if (tx && !tx.trader_id && ['ESCROW_LOCKED', 'TRADER_MATCHED'].includes(tx.state)) {
      logger.info(`[Job:rematch] Retrying match for tx ${transactionId} (no trader assigned yet)`);
      const { default: matchingEngine } = await import('./matchingEngine.js');
      await matchingEngine.matchTrader(transactionId);
    }
    return;
  }

  // Only re-match if still in TRADER_MATCHED, same trader, and NOT accepted
  // [B1] matched_at is set when trader accepts — if set, don't re-match
  if (tx && currentTraderId && tx.state === 'TRADER_MATCHED' && tx.trader_id === currentTraderId && !tx.matched_at) {
    logger.info(`[Job:rematch] Trader ${currentTraderId} timed out on tx ${transactionId} — re-matching`);

    // ── [PHASE 2H] Release canonical match reservation (or legacy float) before re-match ──
    const escrowController = await getEscrowController();
    await escrowController.releaseMatchFloatForTransaction(tx);

    // Decay trader trust score
    await db.query(
      `UPDATE traders SET trust_score = GREATEST(0, trust_score - 2) WHERE id = $1`,
      [currentTraderId]
    );

    // Unassign and reset to ESCROW_LOCKED for re-matching.
    // NOTE: done via raw UPDATE (not the state machine) because TRADER_MATCHED →
    // ESCROW_LOCKED is intentionally NOT a valid forward transition; this is a
    // controlled re-queue, mirroring the decline / orphan-recovery paths.
    await db.query(
      `UPDATE transactions
         SET trader_id = NULL, payout_setting_id = NULL, state = 'ESCROW_LOCKED', trader_matched_at = NULL, updated_at = NOW()
       WHERE id = $1 AND state = 'TRADER_MATCHED'`,
      [transactionId]
    );

    // Lazy-load matchingEngine to avoid circular dependency
    const { default: matchingEngine } = await import('./matchingEngine.js');
    await matchingEngine.matchTrader(transactionId);
  }
});

// ─── Queue: Reset trader daily volumes at midnight ────────
const dailyResetQueue = new Queue('daily-reset', defaultOpts);

dailyResetQueue.process(async () => {
  logger.info('[Job:daily-reset] Resetting trader daily volumes');
  await db.query(`UPDATE traders SET daily_volume = 0`);
  return { reset: true };
});

// Schedule daily reset at midnight UTC
dailyResetQueue.add({}, {
  repeat: { cron: '0 0 * * *' },
  jobId: 'daily-trader-reset',
});

// ─── Queue: Trust score decay for slow traders ────────────
const trustDecayQueue = new Queue('trust-decay', defaultOpts);

trustDecayQueue.process(async (job) => {
  const { traderId, amount } = job.data;
  await db.query(
    `UPDATE traders SET trust_score = GREATEST(0, trust_score - $1) WHERE id = $2`,
    [amount, traderId]
  );
  logger.info(`[Job:trust-decay] Decayed trader ${traderId} by ${amount}`);
});

// ─── [C-3 FIX] Queue: Orphan transaction recovery ────────
const orphanRecoveryQueue = new Queue('orphan-recovery', defaultOpts);

orphanRecoveryQueue.process(async () => {
  logger.info('[Job:orphan-recovery] Scanning for orphaned transactions...');

  const escrowController = await getEscrowController();
  const { default: matchingEngine } = await import('./matchingEngine.js');

  // 1. FIAT_PAYOUT_SUBMITTED for too long → flag for admin (potential dispute)
  const fiatSentMinutes = config.platform.orphanFiatSentMinutes;
  const stuckFiatSent = await db.query(
    `SELECT t.*, u.stellar_address as user_stellar
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.state = 'FIAT_PAYOUT_SUBMITTED'
       AND t.fiat_payout_submitted_at < NOW() - INTERVAL '1 minute' * $1`,
    [fiatSentMinutes]
  );
  for (const tx of stuckFiatSent.rows) {
    logger.warn(`[Job:orphan-recovery] FIAT_PAYOUT_SUBMITTED stuck for tx ${tx.id} — flagging for admin review`);
  }

  // 2. TRADER_MATCHED but never accepted → unassign, restore float, re-match
  const matchedMinutes = config.platform.orphanMatchedMinutes;
  const stuckMatched = await db.query(
    `SELECT t.*, u.stellar_address as user_stellar
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.state = 'TRADER_MATCHED'
       AND t.matched_at IS NULL
       AND t.trader_matched_at < NOW() - INTERVAL '1 minute' * $1`,
    [matchedMinutes]
  );
  for (const tx of stuckMatched.rows) {
    logger.warn(`[Job:orphan-recovery] TRADER_MATCHED orphan: tx ${tx.id} — unassigning and re-matching`);
    await escrowController.releaseMatchFloatForTransaction(tx);
    await db.query(
      `UPDATE transactions SET trader_id = NULL, payout_setting_id = NULL, state = 'ESCROW_LOCKED', trader_matched_at = NULL
       WHERE id = $1 AND state = 'TRADER_MATCHED'`,
      [tx.id]
    );
    await matchingEngine.matchTrader(tx.id);
  }

  // 3. TRADER_MATCHED with no trader_id for too long → refund (no trader available)
  const noTraderMinutes = 5;
  const noTraderAvailable = await db.query(
    `SELECT t.*, u.stellar_address as user_stellar
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.state = 'TRADER_MATCHED'
       AND t.trader_id IS NULL
       AND t.trader_matched_at < NOW() - INTERVAL '1 minute' * $1`,
    [noTraderMinutes]
  );
  for (const tx of noTraderAvailable.rows) {
    logger.warn(`[Job:orphan-recovery] TRADER_MATCHED no trader: tx ${tx.id} — orphan refund path`);
    try {
      const result = await escrowController.refundOrphanTransaction(
        tx.id,
        'Auto-refund: no trader available after swap'
      );
      if (result.status === 'refunded') {
        await notificationService.notifyRefund(tx.user_id, tx, 'No trader available — funds returned');
      }
    } catch (err) {
      logger.error(`[Job:orphan-recovery] Refund failed for tx ${tx.id}:`, err.message);
    }
  }

  // 4. ESCROW_LOCKED with no match attempt for stale period → orphan refund
  const escrowStaleMinutes = Math.ceil((config.platform.traderAcceptTimeoutSeconds * 2) / 60);
  const stuckEscrow = await db.query(
    `SELECT t.*, u.stellar_address as user_stellar
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.state = 'ESCROW_LOCKED'
       AND t.trader_id IS NULL
       AND t.escrow_locked_at < NOW() - INTERVAL '1 minute' * $1`,
    [escrowStaleMinutes]
  );
  for (const tx of stuckEscrow.rows) {
    logger.warn(`[Job:orphan-recovery] ESCROW_LOCKED stale: tx ${tx.id} — orphan refund path`);
    try {
      const result = await escrowController.refundOrphanTransaction(
        tx.id,
        'Auto-refund: orphan recovery (no trader match)'
      );
      if (result.status === 'refunded') {
        await notificationService.notifyRefund(tx.user_id, tx, 'No trader available — auto-refunded');
      }
    } catch (err) {
      logger.error(`[Job:orphan-recovery] Refund failed for tx ${tx.id}:`, err.message);
    }
  }

  return {
    fiatSentFlagged: stuckFiatSent.rows.length,
    matchedRecovered: stuckMatched.rows.length,
    escrowRefunded: stuckEscrow.rows.length,
  };
});

// Schedule orphan recovery every 10 minutes
orphanRecoveryQueue.add({}, {
  repeat: { cron: '*/10 * * * *' },
  jobId: 'orphan-recovery-scan',
});

/**
 * Enqueue a refund job.
 */
function enqueueRefund(transactionId) {
  return refundQueue.add({ transactionId });
}

/**
 * Enqueue a USDC release retry job.
 */
function enqueueRelease(transactionId) {
  return releaseQueue.add({ transactionId });
}

/**
 * Enqueue a re-match delayed job.
 * [P1 FIX] The delay ensures this survives server restarts.
 */
function enqueueReMatch(transactionId, currentTraderId, delaySeconds) {
  const mode = currentTraderId ? 'accept_timeout' : 'retry_match';
  return reMatchQueue.add(
    { transactionId, currentTraderId, mode },
    { delay: delaySeconds * 1000 }
  );
}

/**
 * Enqueue a trust score decay.
 */
function enqueueTrustDecay(traderId, amount = 2) {
  return trustDecayQueue.add({ traderId, amount });
}
/**
 * Enqueue a dispute refund job.
 * Called when dispute is resolved in user's favor.
 */
function enqueueDisputeRefund(transactionId, userId) {
  logger.info(`[JobQueue] Enqueuing dispute refund for tx ${transactionId}`);
  return refundQueue.add(
    { transactionId, dispute: true, userId },
    { priority: 10 } // High priority
  );
}

/**
 * Enqueue a dispute USDC release job.
 * Called when dispute is resolved in trader's favor.
 */
function enqueueDisputeRelease(transactionId, traderId) {
  logger.info(`[JobQueue] Enqueuing dispute release for tx ${transactionId}`);
  return releaseQueue.add(
    { transactionId, dispute: true, traderId },
    { priority: 10 } // High priority
  );
}
export default {
  refundQueue,
  releaseQueue,
  reMatchQueue,
  dailyResetQueue,
  trustDecayQueue,
  orphanRecoveryQueue,
  enqueueRefund,
  enqueueRelease,
  enqueueReMatch,
  enqueueTrustDecay,
  enqueueDisputeRefund,
  enqueueDisputeRelease,
};