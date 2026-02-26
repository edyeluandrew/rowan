import { Router } from 'express';
import { authUser } from '../middleware/auth.js';
import quoteEngine from '../services/quoteEngine.js';
import db from '../db/index.js';

const router = Router();

/**
 * GET /api/v1/user/history
 * List the user's past transactions with amounts, statuses, and timestamps.
 * Query: ?limit=50&offset=0
 */
router.get('/history', authUser, async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT t.id, t.xlm_amount, t.usdc_amount, t.fiat_amount, t.fiat_currency,
              t.network, t.state, t.locked_rate, t.stellar_deposit_tx,
              t.escrow_locked_at, t.completed_at, t.failed_at, t.failure_reason,
              t.created_at,
              q.memo, q.platform_fee
       FROM transactions t
       JOIN quotes q ON q.id = t.quote_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, parseInt(limit), parseInt(offset)]
    );

    // Also get summary stats
    const statsResult = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE state = 'COMPLETE') as total_completed,
         COUNT(*) FILTER (WHERE state = 'FAILED' OR state = 'REFUNDED') as total_failed,
         COALESCE(SUM(fiat_amount) FILTER (WHERE state = 'COMPLETE'), 0) as total_fiat_received,
         COALESCE(SUM(xlm_amount) FILTER (WHERE state = 'COMPLETE'), 0) as total_xlm_cashed
       FROM transactions
       WHERE user_id = $1`,
      [req.userId]
    );

    res.json({
      transactions: result.rows,
      stats: statsResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/user/profile
 * Get the current user's profile.
 */
router.get('/profile', authUser, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, stellar_address, kyc_level, daily_limit, per_tx_limit, daily_limit_ugx, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
