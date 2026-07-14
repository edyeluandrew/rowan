import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authUser, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import quoteEngine from '../services/quoteEngine.js';
import escrowController from '../services/escrowController.js';
import stateMachine from '../services/transactionStateMachine.js';
import disputeService from '../services/disputeService.js';
import auditLogService from '../services/auditLogService.js';
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
import { packTotpSecret, verifyTotpFromStored, upgradeTotpSecretIfPlaintext } from '../utils/totpSecret.js';
import { sensitiveActionLimiter } from '../middleware/rateLimits.js';
import multer from 'multer';
import notificationService from '../services/notificationService.js';
import websocket from '../services/websocket.js';
import { formatShortId } from '../utils/shortId.js';
import disputeEvidenceService from '../services/disputeEvidenceService.js';
import USER_ACTIVE_ORDER_STATES from '../constants/userActiveOrderStates.js';

const router = Router();

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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
              t.escrow_locked_at, t.trader_matched_at, t.matched_at,
              t.completed_at, t.failed_at, t.failure_reason,
              t.created_at,
              q.memo, q.platform_fee
       FROM transactions t
       JOIN quotes q ON q.id = t.quote_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, parseInt(limit), parseInt(offset)]
    );

    // [USDC FIX] usdc_amount is NUMERIC(18,7) decimal in DB, not stroops.
    const transactions = result.rows.map(tx => ({
      ...tx,
      usdc_amount: Number(tx.usdc_amount) || 0,
    }));

    // Also get summary stats
    const statsResult = await db.query(
      `SELECT
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE state = 'COMPLETE')::int as total_completed,
         COUNT(*) FILTER (WHERE state = 'FAILED' OR state = 'REFUNDED')::int as total_failed,
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
 * GET /api/v1/user/notifications/unread
 */
router.get('/notifications/unread', authUser, async (req, res, next) => {
  try {
    const count = await notificationService.unreadCount(req.userId, 'user');
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

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

    const rows = await notificationService.listNotifications(req.userId, 'user', limit, offset);
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM notifications WHERE user_id = $1`,
      [req.userId]
    );
    const total = parseInt(countResult.rows[0].total);

    const notifications = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      transaction_id: n.transaction_id,
      transactionId: n.transaction_id,
      read_at: n.read_at,
      readAt: n.read_at,
      created_at: n.created_at,
      createdAt: n.created_at,
    }));

    res.json({
      notifications,
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
 * PATCH /api/v1/user/notifications/:id/read
 */
router.patch('/notifications/:id/read', authUser, async (req, res, next) => {
  try {
    await notificationService.markRead(req.params.id, req.userId, 'user');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/user/notifications/read-all
 */
router.patch('/notifications/read-all', authUser, async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.userId, 'user');
    res.json({ success: true });
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
          [packTotpSecret(secret), 10, userId]
        );
      } else {
        await db.query(
          `INSERT INTO user_2fa_settings
           (user_id, totp_secret, is_enabled, enabled_at, backup_codes_remaining)
           VALUES ($1, $2, TRUE, NOW(), $3)`,
          [userId, packTotpSecret(secret), 10]
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

      // Helper: issue the real session token only after a successful 2FA check.
      const issueSession = async () => {
        const token = signToken(userId, 'user', req.body.deviceId || null);
        const userRow = (await db.query(
          `SELECT id, stellar_address, kyc_level, daily_limit, per_tx_limit FROM users WHERE id = $1`,
          [userId]
        )).rows[0];
        return {
          token,
          user: userRow
            ? {
                id: userRow.id,
                stellarAddress: userRow.stellar_address,
                kycLevel: userRow.kyc_level,
                dailyLimit: userRow.daily_limit,
                perTxLimit: userRow.per_tx_limit,
              }
            : undefined,
        };
      };

      await upgradeTotpSecretIfPlaintext(db, 'user_2fa_settings', userId, twoFaSettings.totp_secret);

      // Try TOTP code first
      if (verifyTotpFromStored(twoFaSettings.totp_secret, code)) {
        await log2faVerificationUser(db, userId, 'login', 'success', null, req.ip, req.get('user-agent'));
        const session = await issueSession();
        return res.json({ verified: true, method: 'totp', ...session });
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
        const session = await issueSession();
        return res.json({ verified: true, method: 'backup_code', backupCodesRemaining: newCount, ...session });
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
      await upgradeTotpSecretIfPlaintext(db, 'user_2fa_settings', userId, settings.totp_secret);
      if (!verifyTotpFromStored(settings.totp_secret, code)) {
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
      await upgradeTotpSecretIfPlaintext(db, 'user_2fa_settings', userId, settings.totp_secret);
      if (!verifyTotpFromStored(settings.totp_secret, code)) {
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

/**
 * POST /api/v1/user/transactions/:id/confirm-receipt
 * User confirms receipt of mobile money after trader submits payout.
 * Triggers USDC release from escrow to trader Stellar wallet.
 *
 * [PHASE 8] User-side secure receipt confirmation.
 */
router.post('/transactions/:id/confirm-receipt', authUser, sensitiveActionLimiter, async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = req.userId;

    logger.info(`[User] Confirm receipt called for id: ${id}, userId: ${userId}`);

    // Fetch transaction by ID first
    let txResult = await db.query(
      `SELECT id, user_id, state, trader_id, usdc_amount, fiat_amount, fiat_currency, stellar_release_tx
       FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    let transaction = txResult.rows[0];

    // If not found by transaction ID, try by quote_id
    if (!transaction) {
      logger.info(`[User] Transaction not found by ID, trying quote_id: ${id}`);
      txResult = await db.query(
        `SELECT id, user_id, state, trader_id, usdc_amount, fiat_amount, fiat_currency, stellar_release_tx
         FROM transactions WHERE quote_id = $1 AND user_id = $2`,
        [id, userId]
      );
      transaction = txResult.rows[0];
    }

    if (!transaction) {
      logger.warn(`[User] Transaction not found for id: ${id}, userId: ${userId}`);
      return res.status(404).json({
        error: 'Transaction not found',
      });
    }

    const transactionId = transaction.id;

    // Verify state (must be awaiting confirmation)
    if (transaction.state !== 'FIAT_PAYOUT_SUBMITTED' && transaction.state !== 'USER_CONFIRMATION_PENDING') {
      return res.status(409).json({
        error: 'Invalid transaction state',
        details: `Cannot confirm receipt in state ${transaction.state}. Expected FIAT_PAYOUT_SUBMITTED or USER_CONFIRMATION_PENDING.`,
        currentState: transaction.state,
      });
    }

    // Idempotency check: if already has stellar_release_tx, return success
    if (transaction.stellar_release_tx) {
      logger.info(`[User] Confirm receipt already processed for tx ${transactionId}`);
      return res.json({
        status: 'COMPLETE',
        message: 'Receipt already confirmed — USDC has been released to trader.',
        stellarReleaseTx: transaction.stellar_release_tx,
        transactionId: transaction.id,
      });
    }

    // Transition to USER_CONFIRMATION_PENDING if not already there
    if (transaction.state === 'FIAT_PAYOUT_SUBMITTED') {
      await stateMachine.transition(
        transactionId,
        'FIAT_PAYOUT_SUBMITTED',
        'USER_CONFIRMATION_PENDING'
      );
      logger.info(`[User] Transitioned tx ${transactionId} to USER_CONFIRMATION_PENDING`);
    }

    // Attempt USDC release (releaseToTrader handles state transition to COMPLETE)
    try {
      const releaseTxHash = await escrowController.releaseToTrader(transactionId);

      if (!releaseTxHash) {
        const fresh = await db.query(
          `SELECT state, release_error, failure_reason, stellar_release_tx FROM transactions WHERE id = $1`,
          [transactionId]
        );
        const row = fresh.rows[0];
        await auditLogService.log({
          actor_role: 'system',
          action: 'user_confirm_release_blocked',
          resource_type: 'transaction',
          resource_id: transactionId,
          metadata: {
            user_id: userId,
            state: row?.state,
            release_error: row?.release_error,
            failure_reason: row?.failure_reason,
          },
        });
        return res.status(409).json({
          status: 'RELEASE_BLOCKED',
          error: 'Release blocked',
          message: 'USDC could not be released to the trader. Admin review is required before this transaction can complete.',
          currentState: row?.state || 'RELEASE_BLOCKED',
          transactionId,
        });
      }

      logger.info(`[User] Transaction ${transactionId} completed: USDC released, hash ${releaseTxHash}`);

      const chatService = (await import('../services/chatService.js')).default;
      chatService.sendSystemMessage(transactionId, 'Payment confirmed. Transaction complete.').catch(() => {});

      res.json({
        status: 'COMPLETE',
        message: 'Receipt confirmed. USDC has been released to the trader.',
        stellarReleaseTx: releaseTxHash,
        transactionId: transactionId,
        appealExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (releaseErr) {
      logger.error(`[User] Escrow release failed for tx ${transactionId}:`, releaseErr.message);

      // Transition to RELEASE_BLOCKED state
      await stateMachine.transition(
        transactionId,
        'USER_CONFIRMATION_PENDING',
        'RELEASE_BLOCKED',
        { release_error: releaseErr.message }
      );

      res.status(500).json({
        error: 'Release failed',
        details: 'USDC release encountered an error. Please contact support.',
        message: releaseErr.message,
        transactionId: transactionId,
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/user/transactions/active
 * Returns the user's current in-progress order, if any.
 */
router.get('/transactions/active', authUser, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, state, xlm_amount, fiat_amount, fiat_currency, network, created_at
       FROM transactions
       WHERE user_id = $1 AND state::text = ANY($2::text[])
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.userId, USER_ACTIVE_ORDER_STATES]
    );
    const row = result.rows[0];
    if (!row) {
      return res.json({ active: false, transaction: null });
    }
    res.json({
      active: true,
      transaction: {
        id: row.id,
        state: row.state,
        xlm_amount: row.xlm_amount != null ? parseFloat(row.xlm_amount) : null,
        fiat_amount: row.fiat_amount != null ? parseFloat(row.fiat_amount) : null,
        fiat_currency: row.fiat_currency,
        network: row.network,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/user/transactions/history
 * Paginated P2P transaction history with trader and review metadata.
 */
router.get('/transactions/history', authUser, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { status, range } = req.query;

    const params = [req.userId];
    const conditions = ['t.user_id = $1'];

    if (status === 'completed') {
      conditions.push(`t.state = 'COMPLETE'`);
    } else if (status === 'cancelled') {
      conditions.push(`t.state = 'FAILED'`);
    } else if (status === 'refunded') {
      conditions.push(`t.state = 'REFUNDED'`);
    } else if (status === 'disputed') {
      conditions.push(`(t.dispute_id IS NOT NULL OR t.state IN ('DISPUTE_OPENED', 'DISPUTE_REFUND_PENDING', 'DISPUTE_RELEASE_PENDING'))`);
    }

    if (range === 'week') {
      conditions.push(`t.created_at >= NOW() - INTERVAL '7 days'`);
    } else if (range === 'month') {
      conditions.push(`t.created_at >= NOW() - INTERVAL '30 days'`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM transactions t WHERE ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    params.push(limit, offset);
    const result = await db.query(
      `SELECT
         t.id,
         t.state,
         t.xlm_amount,
         t.usdc_amount,
         t.fiat_amount,
         t.fiat_currency,
         t.locked_rate,
         t.network,
         t.order_side,
         t.created_at,
         t.completed_at,
         t.dispute_id,
         t.preferred_payout_setting_id,
         t.trader_id,
         tr.name AS trader_name,
         EXISTS (
           SELECT 1 FROM reviews r
           WHERE r.transaction_id = t.id AND r.reviewer_id = t.user_id
         ) AS review_submitted
       FROM transactions t
       LEFT JOIN traders tr ON tr.id = t.trader_id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const transactions = result.rows.map((row) => {
      const shortRef = row.id.replace(/-/g, '').slice(0, 8).toUpperCase();
      let durationMinutes = null;
      if (row.completed_at && row.created_at) {
        durationMinutes = Math.max(
          1,
          Math.round((new Date(row.completed_at) - new Date(row.created_at)) / 60000)
        );
      }
      const usdcAmount = row.usdc_amount != null ? parseFloat(row.usdc_amount) : null;
      const fiatAmount = row.fiat_amount != null ? parseFloat(row.fiat_amount) : null;
      const rate = row.locked_rate != null ? parseFloat(row.locked_rate) : null;
      // Prefer stored USDC; if missing (legacy rows), derive from fiat ÷ rate.
      let resolvedUsdc = Number.isFinite(usdcAmount) && usdcAmount > 0 ? usdcAmount : null;
      if (resolvedUsdc == null && Number.isFinite(fiatAmount) && fiatAmount > 0
          && Number.isFinite(rate) && rate > 0) {
        resolvedUsdc = parseFloat((fiatAmount / rate).toFixed(7));
      }
      return {
        id: row.id,
        short_id: `ROW-${shortRef}`,
        state: row.state,
        xlm_amount: row.xlm_amount != null ? parseFloat(row.xlm_amount) : null,
        usdc_amount: resolvedUsdc,
        fiat_amount: fiatAmount,
        currency: row.fiat_currency,
        rate,
        locked_rate: rate,
        network: row.network,
        order_side: row.order_side || 'SELL',
        trader_name: row.trader_name,
        trader_id: row.trader_id,
        payment_method: row.network,
        created_at: row.created_at,
        completed_at: row.completed_at,
        duration_minutes: durationMinutes,
        review_submitted: !!row.review_submitted,
        was_disputed: !!row.dispute_id,
        selection_method: row.preferred_payout_setting_id ? 'manual' : 'auto',
      };
    });

    res.json({
      transactions,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/user/transactions/:id/cancel
 * Buyer cancels before trader submits payout (TRADER_MATCHED only).
 */
router.post('/transactions/:id/cancel', authUser, sensitiveActionLimiter, async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = req.userId;

    let txResult = await db.query(
      `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (!txResult.rows[0]) {
      txResult = await db.query(
        `SELECT * FROM transactions WHERE quote_id = $1 AND user_id = $2`,
        [id, userId]
      );
    }
    const tx = txResult.rows[0];
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (tx.state !== 'TRADER_MATCHED') {
      return res.status(409).json({
        error: 'Cancellation is no longer available. Please raise a dispute if you have an issue.',
      });
    }

    if (tx.payment_expires_at) {
      const closingThreshold = new Date(new Date(tx.payment_expires_at).getTime() - 2 * 60 * 1000);
      if (new Date() > closingThreshold) {
        return res.status(409).json({
          error: 'Payment window is closing. Please wait for it to expire or raise a dispute.',
        });
      }
    }

    const transactionId = tx.id;

    await escrowController.releaseMatchFloatForTransaction(tx);

    const failed = await stateMachine.transition(transactionId, 'TRADER_MATCHED', 'FAILED', {
      failure_reason: 'Cancelled by buyer',
    });
    if (!failed) {
      return res.status(409).json({
        error: 'Cancellation is no longer available. Please raise a dispute if you have an issue.',
      });
    }

    const refundResult = await escrowController.refundOrphanTransaction(transactionId, 'Cancelled by buyer');

    const chatService = (await import('../services/chatService.js')).default;
    chatService.sendSystemMessage(
      transactionId,
      'Order was cancelled by the buyer. XLM has been refunded.'
    ).catch(() => {});

    const fresh = await db.query(`SELECT state FROM transactions WHERE id = $1`, [transactionId]);
    const finalState = fresh.rows[0]?.state || 'FAILED';

    websocket.emitToUser(userId, 'transaction_update', {
      transactionId,
      id: transactionId,
      state: finalState,
      message: 'Order cancelled by buyer',
    });
    if (tx.trader_id) {
      websocket.emitToTrader(tx.trader_id, 'transaction_update', {
        transactionId,
        id: transactionId,
        state: finalState,
        message: 'This order was cancelled by the buyer.',
      });
      notificationService.createNotification(
        tx.trader_id,
        'trader',
        'order_cancelled',
        'Order cancelled',
        `The buyer cancelled order ${formatShortId(transactionId)}. Your float has been released.`,
        transactionId
      ).catch(() => {});
    }

    res.json({
      status: finalState,
      message: 'Order cancelled. Refund is being processed.',
      transactionId,
      refundStatus: refundResult?.status || 'pending',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/user/blocked-traders/:traderId
 */
router.post('/blocked-traders/:traderId', authUser, async (req, res, next) => {
  try {
    const userId = req.userId;
    const { traderId } = req.params;
    const traderCheck = await db.query(`SELECT id FROM traders WHERE id = $1`, [traderId]);
    if (!traderCheck.rows[0]) {
      return res.status(404).json({ error: 'Trader not found' });
    }
    await db.query(
      `INSERT INTO blocked_traders (user_id, trader_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, trader_id) DO NOTHING`,
      [userId, traderId]
    );
    res.json({ success: true, message: 'Trader blocked' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/user/blocked-traders/:traderId
 */
router.delete('/blocked-traders/:traderId', authUser, async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM blocked_traders WHERE user_id = $1 AND trader_id = $2`,
      [req.userId, req.params.traderId]
    );
    res.json({ success: true, message: 'Trader unblocked' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/user/blocked-traders
 */
router.get('/blocked-traders', authUser, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT bt.id, bt.trader_id, bt.created_at, t.name AS trader_name
       FROM blocked_traders bt
       JOIN traders t ON t.id = bt.trader_id
       WHERE bt.user_id = $1
       ORDER BY bt.created_at DESC`,
      [req.userId]
    );
    res.json({
      blockedTraders: result.rows.map((row) => ({
        id: row.id,
        traderId: row.trader_id,
        traderName: row.trader_name,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/user/disputes/:disputeId/evidence
 */
router.post(
  '/disputes/:disputeId/evidence',
  authUser,
  evidenceUpload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Evidence file is required' });
      }
      const evidence = await disputeEvidenceService.uploadEvidence(
        req.params.disputeId,
        { userId: req.userId },
        req.file
      );
      res.status(201).json({ success: true, evidence });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      next(err);
    }
  }
);

/**
 * GET /api/v1/user/disputes/:disputeId/evidence
 */
router.get('/disputes/:disputeId/evidence', authUser, async (req, res, next) => {
  try {
    const evidence = await disputeEvidenceService.listEvidence(req.params.disputeId, {
      userId: req.userId,
    });
    res.json({ evidence });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/user/transactions/:id/dispute
 * User reports that they did not receive the mobile money.
 * Blocks USDC release and opens a dispute for admin review.
 *
 * [PHASE 8] User-side dispute path.
 */
router.post('/transactions/:id/dispute', authUser, async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = req.userId;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'Dispute reason is required',
      });
    }

    logger.info(`[User] Dispute opened for id: ${id}, userId: ${userId}`);

    // Fetch transaction by ID first
    let txResult = await db.query(
      `SELECT id, user_id, state, trader_id, usdc_amount, fiat_amount, fiat_currency,
              appeal_expires_at, appeal_archived_at
       FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    let transaction = txResult.rows[0];

    // If not found by transaction ID, try by quote_id
    if (!transaction) {
      logger.info(`[User] Transaction not found by ID, trying quote_id: ${id}`);
      txResult = await db.query(
        `SELECT id, user_id, state, trader_id, usdc_amount, fiat_amount, fiat_currency,
                appeal_expires_at, appeal_archived_at
         FROM transactions WHERE quote_id = $1 AND user_id = $2`,
        [id, userId]
      );
      transaction = txResult.rows[0];
    }

    if (!transaction) {
      logger.warn(`[User] Transaction not found for id: ${id}, userId: ${userId}`);
      return res.status(404).json({
        error: 'Transaction not found',
      });
    }

    const transactionId = transaction.id;

    // A partner must be assigned (always true in disputable states).
    if (!transaction.trader_id) {
      return res.status(409).json({
        error: 'Cannot open dispute',
        details: 'No partner is assigned to this transaction yet.',
      });
    }

    // Canonical dispute path: disputeService creates the dispute record AND
    // transitions the transaction to DISPUTE_OPENED (escrow stays locked,
    // duplicate disputes are rejected, parties + admins are notified).
    try {
      const dispute = await disputeService.createDispute(
        transactionId,
        userId,
        transaction.trader_id,
        reason.trim()
      );

      logger.info(`[User] Dispute ${dispute.id} opened for tx ${transactionId} by user ${userId}`);

      return res.json({
        status: 'DISPUTE_OPENED',
        message: 'Dispute opened. Your USDC stays locked in escrow until an admin reviews your claim.',
        transactionId,
        disputeId: dispute.id,
        reason: reason.trim(),
      });
    } catch (e) {
      if (e.statusCode) {
        return res.status(e.statusCode).json({ error: 'Cannot open dispute', details: e.message });
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
});

export default router;
