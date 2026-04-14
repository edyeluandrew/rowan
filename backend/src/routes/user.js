import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import quoteEngine from '../services/quoteEngine.js';
import db from '../db/index.js';
import logger from '../utils/logger.js';
import { stroopsToUsdc } from '../utils/financial.js';
import {
  generateTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  verifyAndUseBackupCodeUser,
  storeBackupCodesUser,
  getBackupCodeCountUser,
  log2faVerificationUser,
} from '../handlers/totp.js';

const router = Router();

/* ── Rate limiters for 2FA security ── */
const twoFactorSetupLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 setup attempts per window per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId, // Rate limit by user ID, not IP
  message: { error: '2FA setup attempts exceeded. Please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development',
});

const twoFactorDisableLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId,
  message: { error: '2FA disable attempts exceeded. Please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development',
});

const twoFactorVerifyLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many 2FA verification attempts. Please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development',
});

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

    // Convert stroops to decimal USDC for each transaction
    const transactions = result.rows.map(tx => ({
      ...tx,
      usdc_amount: stroopsToUsdc(tx.usdc_amount),
    }));

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
      transactions,
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

/* ═══════════════════════════════════════════════════════════════════════
   TWO-FACTOR AUTHENTICATION (2FA) FOR WALLET USERS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/v1/user/2fa/setup
 * Initiate 2FA setup for wallet user - generate TOTP secret and QR code
 * Requires: authenticated wallet user
 */
router.post(
  '/2fa/setup',
  authUser,
  twoFactorSetupLimiter,
  async (req, res, next) => {
    try {
      const userId = req.userId;

      // Check if 2FA is already enabled
      const existing = await db.query(
        `SELECT id FROM user_2fa_settings WHERE user_id = $1 AND is_enabled = TRUE`,
        [userId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: '2FA is already enabled on this account' });
      }

      // Get user's stellar address for TOTP label
      const userResult = await db.query(
        `SELECT stellar_address FROM users WHERE id = $1`,
        [userId]
      );
      const user = userResult.rows[0];
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Generate TOTP secret
      const { secret, qrCode, manualEntry } = await generateTotpSecret(
        userId,
        user.stellar_address,
        'Rowan Wallet'
      );

      // Generate backup codes
      const { codes } = await generateBackupCodes();

      // Store setup attempt in Redis (valid for 10 minutes)
      const setupKey = `user:2fa_setup:${userId}`;
      const redis = (await import('../db/redis.js')).default;
      await redis.setex(
        setupKey,
        600,
        JSON.stringify({ secret, codes })
      );

      // Return QR code and manual entry option
      res.json({
        qrCode,
        manualEntry,
        setupId: userId,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/user/2fa/verify-setup
 * Verify 2FA setup code and finalize 2FA enabling
 * Body: { code } - 6-digit TOTP code
 * Requires: authenticated wallet user
 */
router.post(
  '/2fa/verify-setup',
  authUser,
  twoFactorSetupLimiter,
  validate(['code']),
  async (req, res, next) => {
    try {
      const userId = req.userId;
      const { code } = req.body;

      // Retrieve setup data from Redis
      const redis = (await import('../db/redis.js')).default;
      const setupKey = `user:2fa_setup:${userId}`;
      const setupData = await redis.get(setupKey);
      if (!setupData) {
        await log2faVerificationUser(db, userId, 'setup', 'failed', 'Setup session expired', null, req.get('user-agent'));
        return res.status(400).json({ error: 'Setup session expired. Please restart 2FA setup.' });
      }

      const { secret, codes } = JSON.parse(setupData);

      // Verify the TOTP code
      const isValid = verifyTotpCode(secret, code);
      if (!isValid) {
        await log2faVerificationUser(db, userId, 'setup', 'failed', 'Invalid TOTP code', null, req.get('user-agent'));
        return res.status(401).json({ error: 'Invalid verification code. Please try again.' });
      }

      // Check/create 2FA settings record
      const existing = await db.query(
        `SELECT id FROM user_2fa_settings WHERE user_id = $1`,
        [userId]
      );

      if (existing.rows.length > 0) {
        // Update existing record
        await db.query(
          `UPDATE user_2fa_settings
           SET totp_secret = $1, is_enabled = TRUE, enabled_at = NOW(), 
               backup_codes_remaining = $2, updated_at = NOW()
           WHERE user_id = $3`,
          [secret, 10, userId]
        );
      } else {
        // Create new record
        await db.query(
          `INSERT INTO user_2fa_settings
           (user_id, totp_secret, is_enabled, enabled_at, backup_codes_remaining)
           VALUES ($1, $2, TRUE, NOW(), $3)`,
          [userId, secret, 10]
        );
      }

      // Store backup codes
      await storeBackupCodesUser(db, userId, codes);

      // Log success
      await log2faVerificationUser(db, userId, 'setup', 'success', null, null, req.get('user-agent'));

      // Clean up Redis setup key
      await redis.del(setupKey);

      // Return backup codes (show once)
      res.json({
        backupCodes: codes,
        message: 'Two-factor authentication enabled. Save your backup codes in a secure location.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/user/2fa/verify-login
 * Verify 2FA code during login (pre-auth endpoint)
 * Body: { userId, code } or { code } (if token already issued)
 * Can be called pre-auth (userId required) or post-auth (token required)
 */
router.post(
  '/2fa/verify-login',
  twoFactorVerifyLoginLimiter,
  validate(['code']),
  async (req, res, next) => {
    try {
      const { code, userId: bodyUserId } = req.body;
      
      // Determine user ID: from auth context or from request body
      const userId = req.userId || bodyUserId;
      if (!userId) {
        return res.status(400).json({ error: 'userId required for pre-auth verification' });
      }

      // Check if 2FA is enabled for this user
      const twoFaResult = await db.query(
        `SELECT totp_secret, is_enabled FROM user_2fa_settings WHERE user_id = $1`,
        [userId]
      );
      const twoFaSettings = twoFaResult.rows[0];

      if (!twoFaSettings || !twoFaSettings.is_enabled) {
        await log2faVerificationUser(db, userId, 'login', 'failed', '2FA not enabled', req.ip, req.get('user-agent'));
        return res.status(400).json({ error: 'Two-factor authentication is not enabled for this account' });
      }

      // Try TOTP code first
      if (verifyTotpCode(twoFaSettings.totp_secret, code)) {
        await log2faVerificationUser(db, userId, 'login', 'success', null, req.ip, req.get('user-agent'));
        return res.json({ verified: true, method: 'totp' });
      }

      // Try backup code
      const backupCodeResult = await verifyAndUseBackupCodeUser(db, userId, code);
      if (backupCodeResult.valid) {
        // Update remaining count
        const newCount = await getBackupCodeCountUser(db, userId);
        await db.query(
          `UPDATE user_2fa_settings SET backup_codes_remaining = $1 WHERE user_id = $2`,
          [newCount, userId]
        );
        await log2faVerificationUser(db, userId, 'login', 'success', null, req.ip, req.get('user-agent'));
        return res.json({ verified: true, method: 'backup_code', backupCodesRemaining: newCount });
      }

      // Both failed
      await log2faVerificationUser(db, userId, 'login', 'failed', 'Invalid TOTP/backup code', req.ip, req.get('user-agent'));
      return res.status(401).json({ error: 'Invalid authentication code' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/user/2fa/disable
 * Disable 2FA for authenticated wallet user
 * Body: { code } - TOTP code to verify ownership
 * Requires: authenticated wallet user
 */
router.post(
  '/2fa/disable',
  authUser,
  twoFactorDisableLimiter,
  validate(['code']),
  async (req, res, next) => {
    try {
      const userId = req.userId;
      const { code } = req.body;

      // Get current 2FA settings
      const result = await db.query(
        `SELECT totp_secret, is_enabled FROM user_2fa_settings WHERE user_id = $1`,
        [userId]
      );
      const settings = result.rows[0];

      if (!settings || !settings.is_enabled) {
        await log2faVerificationUser(db, userId, 'disable', 'failed', '2FA not enabled', null, req.get('user-agent'));
        return res.status(400).json({ error: 'Two-factor authentication is not currently enabled' });
      }

      // Verify TOTP code
      if (!verifyTotpCode(settings.totp_secret, code)) {
        await log2faVerificationUser(db, userId, 'disable', 'failed', 'Invalid TOTP code', null, req.get('user-agent'));
        return res.status(401).json({ error: 'Invalid authentication code' });
      }

      // Disable 2FA
      await db.query(
        `UPDATE user_2fa_settings
         SET is_enabled = FALSE, totp_secret = NULL, updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      // Delete all backup codes
      await db.query(
        `DELETE FROM user_2fa_backup_codes WHERE user_id = $1`,
        [userId]
      );

      // Log success
      await log2faVerificationUser(db, userId, 'disable', 'success', null, null, req.get('user-agent'));

      res.json({ disabled: true, message: '2FA has been disabled on your account' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/user/2fa/backup-codes/regenerate
 * Generate new backup codes (existing codes invalidated)
 * Body: { code } - TOTP code to verify ownership
 * Requires: authenticated wallet user
 */
router.post(
  '/2fa/backup-codes/regenerate',
  authUser,
  twoFactorDisableLimiter,
  validate(['code']),
  async (req, res, next) => {
    try {
      const userId = req.userId;
      const { code } = req.body;

      // Get current 2FA settings
      const result = await db.query(
        `SELECT totp_secret, is_enabled FROM user_2fa_settings WHERE user_id = $1`,
        [userId]
      );
      const settings = result.rows[0];

      if (!settings || !settings.is_enabled) {
        return res.status(400).json({ error: 'Two-factor authentication is not currently enabled' });
      }

      // Verify TOTP code
      if (!verifyTotpCode(settings.totp_secret, code)) {
        await log2faVerificationUser(db, userId, 'regenerate', 'failed', 'Invalid TOTP code', null, req.get('user-agent'));
        return res.status(401).json({ error: 'Invalid authentication code' });
      }

      // Generate new backup codes
      const { codes } = await generateBackupCodes();

      // Store new codes (old ones are deleted)
      await storeBackupCodesUser(db, userId, codes);

      // Update remaining count
      await db.query(
        `UPDATE user_2fa_settings SET backup_codes_remaining = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [10, userId]
      );

      // Log success
      await log2faVerificationUser(db, userId, 'regenerate', 'success', null, null, req.get('user-agent'));

      res.json({
        backupCodes: codes,
        backupCodesRemaining: 10,
        message: 'Backup codes have been regenerated. Old codes are no longer valid.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/user/2fa/status
 * Check if 2FA is enabled and get remaining backup codes count
 * Requires: authenticated wallet user
 */
router.get(
  '/2fa/status',
  authUser,
  async (req, res, next) => {
    try {
      const userId = req.userId;

      const result = await db.query(
        `SELECT is_enabled, backup_codes_remaining FROM user_2fa_settings WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.json({
          isEnabled: false,
          backupCodesRemaining: 0,
        });
      }

      const settings = result.rows[0];
      res.json({
        isEnabled: settings.is_enabled,
        backupCodesRemaining: settings.backup_codes_remaining || 0,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
