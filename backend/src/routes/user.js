import { Router } from 'express';
import { authUser } from '../middleware/auth.js';
import quoteEngine from '../services/quoteEngine.js';
import db from '../db/index.js';
import logger from '../utils/logger.js';

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

/* ═══════════════════════════════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/user/notifications
 * Paginated list of the user's notifications (newest first).
 * Query: ?page=1&limit=20
 */
router.get('/notifications', authUser, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [notifs, countResult] = await Promise.all([
      db.query(
        `SELECT id, type, title, body, data, read_at, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.userId, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*) as total FROM notifications WHERE user_id = $1`,
        [req.userId]
      ),
    ]);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      notifications: notifs.rows,
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/user/notifications/mark-read
 * Mark specific notifications as read.
 * Body: { notificationIds: [uuid, uuid, ...] }
 */
router.post('/notifications/mark-read', authUser, async (req, res, next) => {
  try {
    const { notificationIds } = req.body;
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ error: 'notificationIds array required' });
    }

    await db.query(
      `UPDATE notifications
       SET read_at = now()
       WHERE user_id = $1
         AND id = ANY($2::uuid[])
         AND read_at IS NULL`,
      [req.userId, notificationIds]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/user/notifications/mark-all-read
 * Mark all of the user's notifications as read.
 */
router.post('/notifications/mark-all-read', authUser, async (req, res, next) => {
  try {
    await db.query(
      `UPDATE notifications SET read_at = now()
       WHERE user_id = $1 AND read_at IS NULL`,
      [req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   RATE ALERTS
   ═══════════════════════════════════════════════════════════════════════ */

const MAX_ACTIVE_ALERTS = 10;

/**
 * GET /api/v1/user/rate-alerts
 * List all of the user's rate alerts.
 */
router.get('/rate-alerts', authUser, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, pair, direction, target_rate, active, triggered_at, created_at
       FROM rate_alerts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ alerts: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/user/rate-alerts
 * Create a new rate alert.
 * Body: { pair, direction, targetRate }
 */
router.post('/rate-alerts', authUser, async (req, res, next) => {
  try {
    const { pair, direction, targetRate } = req.body;

    if (!pair || !direction || targetRate == null) {
      return res.status(400).json({ error: 'pair, direction, and targetRate are required' });
    }
    if (!['ABOVE', 'BELOW'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be ABOVE or BELOW' });
    }
    if (typeof targetRate !== 'number' || targetRate <= 0) {
      return res.status(400).json({ error: 'targetRate must be a positive number' });
    }

    // Enforce max active alerts
    const countResult = await db.query(
      `SELECT COUNT(*) as cnt FROM rate_alerts WHERE user_id = $1 AND active = true`,
      [req.userId]
    );
    if (parseInt(countResult.rows[0].cnt) >= MAX_ACTIVE_ALERTS) {
      return res.status(400).json({
        error: `Maximum ${MAX_ACTIVE_ALERTS} active rate alerts allowed`,
      });
    }

    const result = await db.query(
      `INSERT INTO rate_alerts (user_id, pair, direction, target_rate)
       VALUES ($1, $2, $3, $4)
       RETURNING id, pair, direction, target_rate, active, created_at`,
      [req.userId, pair, direction, targetRate]
    );

    res.status(201).json({ alert: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/user/rate-alerts/:id
 * Update a rate alert (e.g. toggle active, change target).
 */
router.patch('/rate-alerts/:id', authUser, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const allowed = ['pair', 'direction', 'target_rate', 'targetRate', 'active'];
    const fields = [];
    const values = [];
    let idx = 2; // $1 = alertId

    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;
      // normalize targetRate → target_rate for SQL
      const col = key === 'targetRate' ? 'target_rate' : key;
      fields.push(`${col} = $${idx}`);
      values.push(updates[key]);
      idx++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const result = await db.query(
      `UPDATE rate_alerts SET ${fields.join(', ')}
       WHERE id = $1 AND user_id = $${idx}
       RETURNING id, pair, direction, target_rate, active, triggered_at, created_at`,
      [id, ...values, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rate alert not found' });
    }

    res.json({ alert: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/user/rate-alerts/:id
 * Delete a rate alert.
 */
router.delete('/rate-alerts/:id', authUser, async (req, res, next) => {
  try {
    const result = await db.query(
      `DELETE FROM rate_alerts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rate alert not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   PUSH TOKENS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/v1/user/push-token
 * Register or update a push notification token for this user.
 * Body: { token, platform? }
 */
router.post('/push-token', authUser, async (req, res, next) => {
  try {
    const { token, platform = 'android' } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    // Upsert: if same user+token exists, just update timestamp
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token) DO UPDATE SET platform = $3, created_at = now()`,
      [req.userId, token, platform]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
