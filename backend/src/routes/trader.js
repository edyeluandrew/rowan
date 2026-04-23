import { Router } from 'express';
import { authTrader, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import matchingEngine from '../services/matchingEngine.js';
import escrowController from '../services/escrowController.js';
import db from '../db/index.js';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { stroopsToUsdc } from '../utils/financial.js';

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
 * Returns: token (if no 2FA) or 2faRequired: true (if 2FA enabled)
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

      // === NEW: CHECK IF 2FA IS ENABLED ===
      const twoFaResult = await db.query(
        `SELECT is_enabled FROM trader_2fa_settings WHERE trader_id = $1`,
        [trader.id]
      );
      const twoFaSettings = twoFaResult.rows[0];
      const has2faEnabled = twoFaSettings && twoFaSettings.is_enabled === true;

      if (has2faEnabled) {
        // Return 2FA challenge required response (do not issue full token yet)
        return res.json({
          requiresTwoFactor: true,
          traderId: trader.id,
          message: 'Enter your authentication code to continue',
        });
      }

      // === NO 2FA: Proceed with normal login ===
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
    
    // Convert stroops to decimal USDC
    const requests = result.rows.map(tx => ({
      ...tx,
      usdc_amount: stroopsToUsdc(tx.usdc_amount),
    }));
    
    res.json({ requests });
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
 * GET /api/v1/trader/profile
 * Full trader profile for the Profile page.
 */
router.get('/profile', authTrader, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, stellar_address, usdc_float,
              daily_limit, daily_volume, trust_score, status,
              verification_status, is_active, networks,
              float_ugx, float_kes, float_tzs,
              created_at, updated_at, last_active_at
       FROM traders WHERE id = $1`,
      [req.traderId]
    );
    const trader = result.rows[0];
    if (!trader) return res.status(404).json({ error: 'Trader not found' });

    // Build float_balances object for the frontend
    const float_balances = {};
    if (trader.float_ugx > 0) float_balances.UGX = Number(trader.float_ugx);
    if (trader.float_kes > 0) float_balances.KES = Number(trader.float_kes);
    if (trader.float_tzs > 0) float_balances.TZS = Number(trader.float_tzs);

    res.json({
      trader: {
        ...trader,
        float_balances,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/history?page=1&limit=20
 * Paginated transaction history for the History page.
 */
router.get('/history', authTrader, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT id, usdc_amount, fiat_amount, fiat_currency, network,
              state, completed_at, created_at
       FROM transactions
       WHERE trader_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.traderId, limit, offset]
    );

    // Convert stroops to decimal USDC
    const transactions = result.rows.map(tx => ({
      ...tx,
      usdc_amount: stroopsToUsdc(tx.usdc_amount),
    }));

    res.json({ transactions });
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

    // Convert stroops to decimal USDC for history items
    const recentTransactions = historyResult.rows.map(tx => ({
      ...tx,
      usdc_amount: stroopsToUsdc(tx.usdc_amount),
    }));

    const todayResult = await db.query(
      `SELECT COUNT(*) as tx_count, COALESCE(SUM(usdc_amount), 0) as total_usdc
       FROM transactions
       WHERE trader_id = $1 AND state = 'COMPLETE' AND completed_at >= CURRENT_DATE`,
      [req.traderId]
    );

    // Convert total_usdc from stroops to decimal
    const todayStats = {
      ...todayResult.rows[0],
      total_usdc: stroopsToUsdc(todayResult.rows[0].total_usdc),
    };

    // Lifetime stats for History page header
    const lifetimeResult = await db.query(
      `SELECT COUNT(*) as completed_count,
              COALESCE(SUM(fiat_amount), 0) as total_volume_ugx,
              COALESCE(SUM(fiat_amount * 0.02), 0) as total_earnings_ugx
       FROM transactions
       WHERE trader_id = $1 AND state = 'COMPLETE'`,
      [req.traderId]
    );

    res.json({
      ...traderResult.rows[0],
      today: todayStats,
      recentTransactions,
      ...lifetimeResult.rows[0],
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

/* ═══════════════════════════════════════════════════════════
 *  WALLET ENDPOINT
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/trader/wallet
 * Stellar wallet details: address, USDC balance, recent receipts.
 */
router.get('/wallet', authTrader, async (req, res, next) => {
  try {
    const traderResult = await db.query(
      `SELECT stellar_address, usdc_float FROM traders WHERE id = $1`,
      [req.traderId]
    );
    const trader = traderResult.rows[0];
    if (!trader) return res.status(404).json({ error: 'Trader not found' });

    // Recent completed transactions (USDC receipts to this trader)
    const txResult = await db.query(
      `SELECT id, usdc_amount, fiat_amount, fiat_currency, state,
              stellar_release_tx, completed_at, created_at
       FROM transactions
       WHERE trader_id = $1 AND state = 'COMPLETE'
       ORDER BY completed_at DESC
       LIMIT 20`,
      [req.traderId]
    );

    res.json({
      stellar_address: trader.stellar_address,
      usdc_balance: parseFloat(trader.usdc_float) || 0,
      recent_transactions: txResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/trader/wallet/verify
 * Verify / update the trader's Stellar receiving address.
 */
router.post('/wallet/verify', authTrader, async (req, res, next) => {
  try {
    const { stellarAddress } = req.body;
    if (!stellarAddress || !stellarAddress.startsWith('G') || stellarAddress.length !== 56) {
      return res.status(400).json({ error: 'Invalid Stellar address. Must start with G and be 56 characters.' });
    }

    // Check uniqueness
    const existing = await db.query(
      `SELECT id FROM traders WHERE stellar_address = $1 AND id != $2`,
      [stellarAddress, req.traderId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This Stellar address is already registered to another trader.' });
    }

    await db.query(
      `UPDATE traders SET stellar_address = $1, updated_at = NOW() WHERE id = $2`,
      [stellarAddress, req.traderId]
    );

    logger.info(`[Trader] ${req.traderId} updated Stellar address to ${stellarAddress}`);
    res.json({ success: true, stellar_address: stellarAddress });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════
 *  SLA PERFORMANCE ENDPOINT
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/trader/sla?period=30d
 * SLA metrics: met rate, avg payout time, breaches, breakdown.
 * SLA target: payout within 5 minutes (300s) of being matched.
 */
router.get('/sla', authTrader, async (req, res, next) => {
  try {
    const period = req.query.period || '30d';
    const intervalMap = { '7d': '7 days', '30d': '30 days', '90d': '90 days' };
    const interval = intervalMap[period] || '30 days';

    // Get all completed/failed transactions in period with payout timing
    const txResult = await db.query(
      `SELECT id,
              EXTRACT(EPOCH FROM (fiat_sent_at - trader_matched_at)) as payout_seconds,
              EXTRACT(EPOCH FROM (trader_matched_at - escrow_locked_at)) as response_seconds,
              fiat_sent_at, trader_matched_at, completed_at, state
       FROM transactions
       WHERE trader_id = $1
         AND state IN ('COMPLETE', 'FAILED')
         AND trader_matched_at IS NOT NULL
         AND created_at >= NOW() - $2::INTERVAL
       ORDER BY created_at DESC`,
      [req.traderId, interval]
    );

    const txs = txResult.rows;
    const SLA_TARGET = 300; // 5 minutes in seconds

    // Filter valid transactions (have both matched and fiat_sent timestamps)
    const withPayout = txs.filter(t => t.payout_seconds != null && t.payout_seconds >= 0);

    const totalWithPayout = withPayout.length;
    const slaMet = withPayout.filter(t => t.payout_seconds <= SLA_TARGET).length;
    const slaBreaches = totalWithPayout - slaMet;
    const slaMetRate = totalWithPayout > 0 ? (slaMet / totalWithPayout) * 100 : 100;

    const avgPayout = totalWithPayout > 0
      ? withPayout.reduce((s, t) => s + t.payout_seconds, 0) / totalWithPayout
      : 0;

    const withResponse = txs.filter(t => t.response_seconds != null && t.response_seconds >= 0);
    const avgResponse = withResponse.length > 0
      ? withResponse.reduce((s, t) => s + t.response_seconds, 0) / withResponse.length
      : 0;

    const bestTime = withPayout.length > 0
      ? Math.min(...withPayout.map(t => t.payout_seconds))
      : null;

    // Breakdown: last 20 transactions
    const breakdown = withPayout.slice(0, 20).map(t => ({
      transaction_id: t.id,
      payout_time: Math.round(t.payout_seconds),
      met: t.payout_seconds <= SLA_TARGET,
    }));

    res.json({
      slaMetRate: Math.round(slaMetRate * 10) / 10,
      averagePayoutTime: Math.round(avgPayout),
      averageResponseTime: Math.round(avgResponse),
      slaBreaches,
      best_time: bestTime != null ? Math.round(bestTime) : null,
      breakdown,
    });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════
 *  NETWORK PERFORMANCE ENDPOINT
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/trader/performance/networks
 * Per-network stats: completion rate, avg time, volume.
 */
router.get('/performance/networks', authTrader, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         t.network,
         COUNT(*) as total_transactions,
         COUNT(*) FILTER (WHERE t.state = 'COMPLETE') as completed,
         ROUND(
           COUNT(*) FILTER (WHERE t.state = 'COMPLETE')::NUMERIC /
           NULLIF(COUNT(*), 0) * 100, 1
         ) as completion_rate,
         ROUND(
           AVG(EXTRACT(EPOCH FROM (t.fiat_sent_at - t.trader_matched_at)))
           FILTER (WHERE t.fiat_sent_at IS NOT NULL AND t.trader_matched_at IS NOT NULL)
         ) as avg_time,
         COALESCE(SUM(t.fiat_amount) FILTER (WHERE t.state = 'COMPLETE'), 0) as total_volume
       FROM transactions t
       WHERE t.trader_id = $1
         AND t.state IN ('COMPLETE', 'FAILED', 'REFUNDED')
       GROUP BY t.network
       ORDER BY total_transactions DESC`,
      [req.traderId]
    );

    const byNetwork = result.rows.map(row => ({
      network: row.network,
      totalTransactions: parseInt(row.total_transactions),
      completionRate: parseFloat(row.completion_rate) || 0,
      avg_time: row.avg_time != null ? parseInt(row.avg_time) : null,
      total_volume: parseFloat(row.total_volume) || 0,
    }));

    res.json({ byNetwork });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/notifications
 * List trader notifications with pagination.
 */
router.get('/notifications', authTrader, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const unreadOnly = req.query.unreadOnly === 'true';
    const offset = (page - 1) * limit;

    const whereClause = unreadOnly ? 'AND is_read = FALSE' : '';
    
    const result = await db.query(
      `SELECT id, type, title, body, is_read, created_at
       FROM trader_notifications
       WHERE trader_id = $1 ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.traderId, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM trader_notifications
       WHERE trader_id = $1 ${whereClause}`,
      [req.traderId]
    );

    res.json({
      notifications: result.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/float/health
 * Show current float balance and health status.
 */
router.get('/float/health', authTrader, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, is_active, float_ugx, float_kes, float_tzs, 
              daily_limit, daily_volume, trust_score, last_active_at
       FROM traders
       WHERE id = $1`,
      [req.traderId]
    );

    const trader = result.rows[0];
    if (!trader) {
      return res.status(404).json({ error: 'Trader not found' });
    }

    // Calculate float health percentage
    const minFloat = 100000; // Minimum expected float
    const floatUgxHealth = Math.min(100, (trader.float_ugx / minFloat) * 100);
    const floatKesHealth = Math.min(100, (trader.float_kes / minFloat) * 100);
    const floatTzsHealth = Math.min(100, (trader.float_tzs / minFloat) * 100);

    res.json({
      traderId: trader.id,
      name: trader.name,
      isActive: trader.is_active,
      floats: {
        ugx: {
          balance: parseFloat(trader.float_ugx),
          health: Math.round(floatUgxHealth),
        },
        kes: {
          balance: parseFloat(trader.float_kes),
          health: Math.round(floatKesHealth),
        },
        tzs: {
          balance: parseFloat(trader.float_tzs),
          health: Math.round(floatTzsHealth),
        },
      },
      dailyLimit: parseFloat(trader.daily_limit),
      dailyVolume: parseFloat(trader.daily_volume),
      remainingDaily: parseFloat(trader.daily_limit) - parseFloat(trader.daily_volume),
      trustScore: parseFloat(trader.trust_score),
      lastActiveAt: trader.last_active_at,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
