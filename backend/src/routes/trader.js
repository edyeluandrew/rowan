import { Router } from 'express';
import { authTrader, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import matchingEngine from '../services/matchingEngine.js';
import escrowController from '../services/escrowController.js';
import db from '../db/index.js';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const router = Router();

// Lazy-load jobQueue to avoid circular deps
let jobQueueModule = null;
async function getJobQueue() {
  if (!jobQueueModule) {
    jobQueueModule = (await import('../services/jobQueue.js')).default;
  }
  return jobQueueModule;
}

/**
 * POST /api/v1/trader/login
 * Trader authentication.
 * Body: { email, password }
 */
router.post(
  '/login',
  validate(['email', 'password']),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const result = await db.query(
        `SELECT * FROM traders WHERE email = $1`,
        [email]
      );
      const trader = result.rows[0];

      if (!trader || !(await bcrypt.compare(password, trader.password_hash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // ── [M-9 FIX] Status-specific login error messages ──
      if (trader.status === 'BANNED') {
        return res.status(403).json({ error: 'Account permanently banned. Contact support.' });
      }
      if (trader.status === 'SUSPENDED' || trader.is_suspended) {
        return res.status(403).json({ error: 'Account suspended pending review. Contact support.' });
      }
      if (trader.status === 'PAUSED') {
        // Paused traders can still log in, they just won't receive matches
      }

      const token = signToken(trader.id, 'trader');

      // Update last active
      await db.query(
        `UPDATE traders SET last_active_at = NOW(), is_active = TRUE WHERE id = $1`,
        [trader.id]
      );

      res.json({
        token,
        trader: {
          id: trader.id,
          name: trader.name,
          stellarAddress: trader.stellar_address,
          usdcFloat: trader.usdc_float,
          dailyLimit: trader.daily_limit,
          dailyVolume: trader.daily_volume,
          trustScore: trader.trust_score,
          verificationStatus: trader.verification_status,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/trader/requests
 * List pending requests assigned to this trader.
 */
router.get('/requests', authTrader, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, usdc_amount, fiat_amount, fiat_currency, network,
              state, trader_matched_at, created_at
       FROM transactions
       WHERE trader_id = $1 AND state IN ('TRADER_MATCHED', 'FIAT_SENT')
       ORDER BY trader_matched_at DESC`,
      [req.traderId]
    );
    res.json({ requests: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/trader/requests/:id/accept
 * Trader accepts a cash-out request.
 */
router.post('/requests/:id/accept', authTrader, async (req, res, next) => {
  try {
    const data = await matchingEngine.acceptRequest(req.params.id, req.traderId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/trader/requests/:id/confirm
 * Trader confirms they have sent mobile money.
 *
 * [B4 FIX] Wraps escrow release in try/catch. On failure, enqueues a
 * Bull retry job so the trader still receives their USDC.
 */
router.post('/requests/:id/confirm', authTrader, async (req, res, next) => {
  try {
    const transaction = await matchingEngine.confirmPayout(req.params.id, req.traderId);

    // Attempt escrow release — retry via Bull on failure
    try {
      const releaseTxHash = await escrowController.releaseToTrader(transaction.id);
      res.json({
        status: 'COMPLETE',
        message: 'Payout confirmed. USDC released to your wallet.',
        stellarReleaseTx: releaseTxHash,
      });
    } catch (releaseErr) {
      logger.error(`[Trader] Escrow release failed for tx ${transaction.id}:`, releaseErr.message);

      // Enqueue retry via Bull (3 attempts with exponential backoff)
      const jobQueue = await getJobQueue();
      await jobQueue.enqueueRelease(transaction.id);

      res.json({
        status: 'FIAT_SENT',
        message: 'Payout confirmed. USDC release is being processed (will retry automatically).',
        retrying: true,
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/stats
 * Trader's float balance, daily volume, and recent history.
 */
router.get('/stats', authTrader, async (req, res, next) => {
  try {
    const traderResult = await db.query(
      `SELECT usdc_float, daily_limit, daily_volume, trust_score
       FROM traders WHERE id = $1`,
      [req.traderId]
    );

    const historyResult = await db.query(
      `SELECT id, usdc_amount, fiat_amount, fiat_currency, state, completed_at, created_at
       FROM transactions
       WHERE trader_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.traderId]
    );

    const todayResult = await db.query(
      `SELECT COUNT(*) as tx_count, COALESCE(SUM(usdc_amount), 0) as total_usdc
       FROM transactions
       WHERE trader_id = $1 AND state = 'COMPLETE' AND completed_at >= CURRENT_DATE`,
      [req.traderId]
    );

    res.json({
      ...traderResult.rows[0],
      today: todayResult.rows[0],
      recentTransactions: historyResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/trader/requests/:id/decline
 * Trader declines a request. Backend re-runs matching to next available trader.
 */
router.post('/requests/:id/decline', authTrader, async (req, res, next) => {
  try {
    const txResult = await db.query(
      `SELECT * FROM transactions WHERE id = $1 AND trader_id = $2 AND state = 'TRADER_MATCHED'`,
      [req.params.id, req.traderId]
    );
    const tx = txResult.rows[0];
    if (!tx) return res.status(404).json({ error: 'Request not found or not in a declinable state' });

    // Unassign trader and re-match
    await db.query(
      `UPDATE transactions SET trader_id = NULL, state = 'ESCROW_LOCKED', trader_matched_at = NULL
       WHERE id = $1`,
      [req.params.id]
    );

    // ── [C-2 FIX] Restore trader float on decline ──
    await escrowController.restoreTraderFloat(tx);

    // Slight trust score decay for declining
    await db.query(
      `UPDATE traders SET trust_score = GREATEST(0, trust_score - 1) WHERE id = $1`,
      [req.traderId]
    );

    // Re-run matching algorithm
    matchingEngine.matchTrader(tx.id).catch((err) => {
      logger.error(`[Trader] Re-match after decline failed:`, err.message);
    });

    res.json({ success: true, message: 'Request declined. It will be routed to another trader.' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/trader/float
 * Trader updates their declared available fiat float.
 * Body: { floatUgx?, floatKes?, floatTzs? } — at least one required
 * [H-6 FIX] Support all three currency float columns.
 */
router.put('/float', authTrader, async (req, res, next) => {
  try {
    const { floatUgx, floatKes, floatTzs } = req.body;

    // At least one must be provided
    if (floatUgx === undefined && floatKes === undefined && floatTzs === undefined) {
      return res.status(400).json({ error: 'At least one of floatUgx, floatKes, floatTzs is required' });
    }

    // Build dynamic SET clause
    const sets = [];
    const params = [];
    let idx = 1;

    if (floatUgx !== undefined && floatUgx !== null) {
      if (parseFloat(floatUgx) < 0) return res.status(400).json({ error: 'floatUgx must be >= 0' });
      sets.push(`float_ugx = $${idx++}`);
      params.push(parseInt(floatUgx));
    }
    if (floatKes !== undefined && floatKes !== null) {
      if (parseFloat(floatKes) < 0) return res.status(400).json({ error: 'floatKes must be >= 0' });
      sets.push(`float_kes = $${idx++}`);
      params.push(parseInt(floatKes));
    }
    if (floatTzs !== undefined && floatTzs !== null) {
      if (parseFloat(floatTzs) < 0) return res.status(400).json({ error: 'floatTzs must be >= 0' });
      sets.push(`float_tzs = $${idx++}`);
      params.push(parseInt(floatTzs));
    }

    params.push(req.traderId);
    await db.query(
      `UPDATE traders SET ${sets.join(', ')} WHERE id = $${idx}`,
      params
    );

    res.json({
      success: true,
      ...(floatUgx !== undefined && { floatUgx: parseInt(floatUgx) }),
      ...(floatKes !== undefined && { floatKes: parseInt(floatKes) }),
      ...(floatTzs !== undefined && { floatTzs: parseInt(floatTzs) }),
      message: 'Float updated. You will now be matched for requests within your declared float.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
