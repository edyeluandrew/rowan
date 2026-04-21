import Queue from 'bull';
import config from '../config/index.js';
import db from '../db/index.js';
import websocket from '../services/websocket.js';
import notificationService from '../services/notificationService.js';
import stateMachine from './transactionStateMachine.js';
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
  const { transactionId } = job.data;
  logger.info(`[Job:refund] Processing refund for tx ${transactionId}`);

  const escrowController = await getEscrowController();

  const result = await db.query(
    `SELECT t.*, u.stellar_address as user_stellar
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.id = $1 AND t.state IN ('FAILED', 'TRADER_MATCHED')`,
    [transactionId]
  );
  const tx = result.rows[0];
  if (!tx) throw new Error(`Transaction ${transactionId} not found or not refundable`);

  // ── [C-2 FIX] Restore trader float if a trader was matched ──
  if (tx.trader_id) {
    await escrowController.restoreTraderFloat(tx);
  }

  const refundHash = await escrowController.refundXlm(
    tx.user_stellar,
    tx.xlm_amount,
    `Auto-refund: ${tx.failure_reason || 'No trader available'}`
  );

  await stateMachine.transition(transactionId, tx.state, 'REFUNDED', {
    stellar_refund_tx: refundHash,
  });

  // [SMS Integration] notify with async fallback
  await notificationService.notifyRefund(tx.user_id, tx, tx.failure_reason || 'No trader available');

  return { refundHash };
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
  const { transactionId } = job.data;
  logger.info(`[Job:release] Retrying USDC release for tx ${transactionId}`);

  const escrowController = await getEscrowController();
  const releaseHash = await escrowController.releaseToTrader(transactionId);
  logger.info(`[Job:release] Release succeeded for tx ${transactionId}: ${releaseHash}`);

  // Notify both parties on successful release
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
  const { transactionId, currentTraderId } = job.data;

  const result = await db.query(
    `SELECT * FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const tx = result.rows[0];

  // Only re-match if still in TRADER_MATCHED, same trader, and NOT accepted
  // [B1] matched_at is set when trader accepts — if set, don't re-match
  if (tx && tx.state === 'TRADER_MATCHED' && tx.trader_id === currentTraderId && !tx.matched_at) {
    logger.info(`[Job:rematch] Trader ${currentTraderId} timed out on tx ${transactionId} — re-matching`);

    // ── [C-2 FIX] Restore trader float before re-matching ──
    const escrowController = await getEscrowController();
    await escrowController.restoreTraderFloat(tx);

    // Decay trader trust score
    await db.query(
      `UPDATE traders SET trust_score = GREATEST(0, trust_score - 2) WHERE id = $1`,
      [currentTraderId]
    );

    // Unassign and reset to ESCROW_LOCKED for re-matching
    await stateMachine.transition(transactionId, 'TRADER_MATCHED', 'ESCROW_LOCKED', {
      trader_id: null,
    });

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

  // 1. FIAT_SENT for too long → flag for admin (potential dispute)
  const fiatSentMinutes = config.platform.orphanFiatSentMinutes;
  const stuckFiatSent = await db.query(
    `SELECT t.*, u.stellar_address as user_stellar
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.state = 'FIAT_SENT'
       AND t.fiat_sent_at < NOW() - INTERVAL '1 minute' * $1`,
    [fiatSentMinutes]
  );
  for (const tx of stuckFiatSent.rows) {
    logger.warn(`[Job:orphan-recovery] FIAT_SENT stuck for tx ${tx.id} — flagging for admin review`);
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
    await escrowController.restoreTraderFloat(tx);
    await db.query(
      `UPDATE transactions SET trader_id = NULL, state = 'ESCROW_LOCKED', trader_matched_at = NULL
       WHERE id = $1 AND state = 'TRADER_MATCHED'`,
      [tx.id]
    );
    await matchingEngine.matchTrader(tx.id);
  }

  // 3. TRADER_MATCHED with no trader_id for too long → refund (no trader available)
  // [NEW] Handle early state transition to TRADER_MATCHED (swap complete, awaiting trader match)
  const noTraderMinutes = 5; // Give 5 minutes to find a trader, then refund
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
    logger.warn(`[Job:orphan-recovery] TRADER_MATCHED no trader: tx ${tx.id} — auto-refunding (no trader available after 5 min)`);
    try {
      const refundHash = await escrowController.refundXlm(
        tx.user_stellar, tx.xlm_amount, 'No trader available after swap'
      );
      await stateMachine.transition(tx.id, 'TRADER_MATCHED', 'REFUNDED', {
        stellar_refund_tx: refundHash,
        failure_reason: 'Auto-refund: no trader available',
      });
      await notificationService.notifyRefund(tx.user_id, tx, 'No trader available — XLM refunded to wallet');
    } catch (err) {
      logger.error(`[Job:orphan-recovery] Refund failed for tx ${tx.id}:`, err.message);
    }
  }

  // 4. ESCROW_LOCKED with no match attempt for > 2× accept timeout → refund (old flow)
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
    logger.warn(`[Job:orphan-recovery] ESCROW_LOCKED stale: tx ${tx.id} — auto-refunding`);
    try {
      const refundHash = await escrowController.refundXlm(
        tx.user_stellar, tx.xlm_amount, 'Orphan recovery: no trader available'
      );
      await db.query(
        `UPDATE transactions SET state = 'REFUNDED', stellar_refund_tx = $1, refunded_at = NOW(),
         failure_reason = 'Auto-refund: orphan recovery' WHERE id = $2`,
        [refundHash, tx.id]
      );
      await notificationService.notifyRefund(tx.user_id, tx, 'No trader available — auto-refunded');
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
  return reMatchQueue.add(
    { transactionId, currentTraderId },
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