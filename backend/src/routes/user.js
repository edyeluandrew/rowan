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

      res.json({
        status: 'COMPLETE',
        message: 'Receipt confirmed. USDC has been released to the trader.',
        stellarReleaseTx: releaseTxHash,
        transactionId: transactionId,
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
      `SELECT id, user_id, state, trader_id, usdc_amount, fiat_amount, fiat_currency
       FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    let transaction = txResult.rows[0];

    // If not found by transaction ID, try by quote_id
    if (!transaction) {
      logger.info(`[User] Transaction not found by ID, trying quote_id: ${id}`);
      txResult = await db.query(
        `SELECT id, user_id, state, trader_id, usdc_amount, fiat_amount, fiat_currency
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
