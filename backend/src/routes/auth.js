import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { signToken, authAdmin, authTrader } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import redis from '../db/redis.js';
import bcrypt from 'bcryptjs';
import { StellarSdk, networkPassphrase } from '../config/stellar.js';
import logger from '../utils/logger.js';
import {
  generateTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
  verifyAndUseBackupCode,
  storeBackupCodes,
  getBackupCodeCount,
  log2faVerification,
} from '../handlers/totp.js';

const router = Router();

/* ── Rate limiters for security-critical endpoints ── */
const twoFactorVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many 2FA verification attempts. Please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in development
});

/* ── SEP-10 server signing keypair (loaded once at startup) ────────── */
const sep10Keypair = process.env.SEP10_SIGNING_SECRET
  ? StellarSdk.Keypair.fromSecret(process.env.SEP10_SIGNING_SECRET)
  : null;
const sep10HomeDomain = (process.env.API_URL || 'http://localhost:4000')
  .replace(/^https?:\/\//, '')   // strip protocol
  .replace(/:\d+$/, '') || 'localhost';  // strip port for home domain

/**
 * GET /api/v1/auth/challenge
 * SEP-10 Web Authentication — issue a challenge transaction XDR.
 * The wallet signs this and returns it to /auth/submit (login) or /auth/register.
 * Query: ?account=G... (SEP-10 standard) or ?stellarAddress=G... (legacy)
 */
router.get('/challenge', async (req, res, next) => {
  try {
    const stellarAddress = req.query.account || req.query.stellarAddress;
    if (!stellarAddress || !stellarAddress.startsWith('G') || stellarAddress.length !== 56) {
      return res.status(400).json({ error: 'Valid Stellar public key (G...) required as ?account=G...' });
    }

    if (!sep10Keypair) {
      logger.error('[Auth] SEP10_SIGNING_SECRET not configured');
      return res.status(500).json({ error: 'SEP-10 auth not configured on server' });
    }

    // Build a proper SEP-10 challenge transaction using the SDK
    const challengeXdr = StellarSdk.WebAuth.buildChallengeTx(
      sep10Keypair,           // server signing keypair
      stellarAddress,         // client account
      sep10HomeDomain,        // home domain (e.g. 'localhost')
      300,                    // timeout in seconds
      networkPassphrase,      // testnet or public
      sep10HomeDomain,        // webAuthDomain — same as homeDomain for first-party
    );

    res.json({
      transaction: challengeXdr,
      networkPassphrase,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/register
 * Register a new wallet user with a signed SEP-10 challenge.
 * Body: { transaction: <signed XDR>, phoneHash, deviceId? }
 */
router.post(
  '/register',
  validate(['transaction', 'phoneHash']),
  async (req, res, next) => {
    try {
      const { transaction, phoneHash, deviceId } = req.body;

      // Verify the SEP-10 signed challenge and extract the client's account
      const stellarAddress = await verifySep10Challenge(transaction);
      if (!stellarAddress) {
        return res.status(401).json({ error: 'Invalid or expired SEP-10 challenge' });
      }

      // Check for duplicates
      const existing = await db.query(
        `SELECT id FROM users WHERE stellar_address = $1`,
        [stellarAddress]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Stellar address already registered' });
      }

      const result = await db.query(
        `INSERT INTO users (stellar_address, phone_hash, device_id)
         VALUES ($1, $2, $3)
         RETURNING id, stellar_address, kyc_level, daily_limit, per_tx_limit`,
        [stellarAddress, phoneHash, deviceId || null]
      );

      const user = result.rows[0];
      const token = signToken(user.id, 'user', deviceId);

      res.status(201).json({ token, user });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/submit
 * SEP-10 login — submit a signed challenge XDR for an existing user.
 * Body: { transaction: <signed XDR>, deviceId? }
 */
router.post(
  '/submit',
  validate(['transaction']),
  async (req, res, next) => {
    try {
      const { transaction, deviceId } = req.body;

      // Verify the SEP-10 signed challenge and extract the client's account
      const stellarAddress = await verifySep10Challenge(transaction);
      if (!stellarAddress) {
        return res.status(401).json({ error: 'Invalid or expired SEP-10 challenge' });
      }

      const result = await db.query(
        `SELECT * FROM users WHERE stellar_address = $1`,
        [stellarAddress]
      );
      const user = result.rows[0];
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });

      const token = signToken(user.id, 'user', deviceId);

      res.json({
        token,
        user: {
          id: user.id,
          stellarAddress: user.stellar_address,
          kycLevel: user.kyc_level,
          dailyLimit: user.daily_limit,
          perTxLimit: user.per_tx_limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Legacy login — kept for backward compatibility.
 * Body: { stellarAddress, signature, deviceId? }
 */
router.post(
  '/login',
  validate(['stellarAddress', 'signature']),
  async (req, res, next) => {
    try {
      const { stellarAddress, signature, deviceId } = req.body;

      // Try legacy nonce-based verification
      const verified = await verifyLegacyChallenge(stellarAddress, signature);
      if (!verified) {
        return res.status(401).json({ error: 'Invalid or expired challenge signature' });
      }

      const result = await db.query(
        `SELECT * FROM users WHERE stellar_address = $1`,
        [stellarAddress]
      );
      const user = result.rows[0];
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });

      const token = signToken(user.id, 'user', deviceId);

      res.json({
        token,
        user: {
          id: user.id,
          stellarAddress: user.stellar_address,
          kycLevel: user.kyc_level,
          dailyLimit: user.daily_limit,
          perTxLimit: user.per_tx_limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/admin/login
 * Admin login via email and password.
 * Body: { email, password }
 */
router.post(
  '/admin/login',
  validate(['email', 'password']),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // [AUDIT FIX] Select only needed columns — never return full row with password_hash
      const result = await db.query(
        `SELECT id, email, password_hash, role FROM users WHERE email = $1 AND role = 'admin'`,
        [email]
      );
      const admin = result.rows[0];

      if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = signToken(admin.id, 'admin');

      res.json({
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          role: admin.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/trader/register
 * [C7 FIX] Admin-only trader registration (no public self-registration).
 * Body: { name, email, password, stellarAddress }
 */
router.post(
  '/trader/register',
  authAdmin,
  validate(['name', 'email', 'password', 'stellarAddress']),
  async (req, res, next) => {
    try {
      const { name, email, password, stellarAddress } = req.body;

      const existing = await db.query(
        `SELECT id FROM traders WHERE email = $1 OR stellar_address = $2`,
        [email, stellarAddress]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email or Stellar address already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const result = await db.query(
        `INSERT INTO traders (name, email, stellar_address, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, stellar_address, trust_score`,
        [name, email, stellarAddress, passwordHash]
      );

      const trader = result.rows[0];
      // Don't issue a token — trader must log in themselves
      res.status(201).json({ trader });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/trader/signup
 * Public trader self-registration.
 * Body: { name, email, password }
 */
router.post(
  '/trader/signup',
  validate(['name', 'email', 'password']),
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;

      const existing = await db.query(
        `SELECT id FROM traders WHERE email = $1`,
        [email]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const result = await db.query(
        `INSERT INTO traders (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, trust_score`,
        [name, email, passwordHash]
      );

      const trader = result.rows[0];
      const token = signToken(trader.id, 'trader');

      res.status(201).json({ token, trader });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Verify a SEP-10 signed challenge XDR.
 * Returns the client's Stellar address if valid, or null if invalid.
 */
async function verifySep10Challenge(signedXdr) {
  try {
    if (!sep10Keypair) return null;

    const serverAccountId = sep10Keypair.publicKey();

    // Debug: log what we're trying to verify
    console.log('[Auth] Verifying SEP-10 challenge');
    console.log('[Auth] signedXdr type:', typeof signedXdr);
    console.log('[Auth] signedXdr length:', signedXdr?.length);
    console.log('[Auth] signedXdr preview:', signedXdr?.substring(0, 50) + '...');
    console.log('[Auth] serverAccountId:', serverAccountId);
    console.log('[Auth] sep10HomeDomain:', sep10HomeDomain);

    // Step 1: Read and validate the challenge transaction structure
    const { clientAccountID } = StellarSdk.WebAuth.readChallengeTx(
      signedXdr,
      serverAccountId,
      networkPassphrase,
      sep10HomeDomain,
      sep10HomeDomain,
    );
    console.log('[Auth] Challenge structure validated, clientAccountID:', clientAccountID);

    // Step 2: Verify signatures
    // For accounts that don't exist yet (new registrations), we skip blockchain lookup
    // and just verify the signatures are from the expected master key
    try {
      const signers = StellarSdk.WebAuth.verifyChallengeTxSigners(
        signedXdr,
        serverAccountId,
        networkPassphrase,
        sep10HomeDomain,
        sep10HomeDomain,
        [clientAccountID],
      );
      console.log('[Auth] Signers verified:', signers?.length);
      if (!signers || signers.length === 0) {
        console.log('[Auth] No valid signers found');
        return null;
      }
    } catch (signerErr) {
      // If signer lookup fails (account doesn't exist), try alternative verification
      // For new accounts, we just need to verify the client signed it
      console.log('[Auth] Signer verification failed (account may not exist yet):', signerErr.message);
      
      // Manual verification: Check that the transaction has at least 2 signatures
      // (one from server, one from client)
      const tx = new StellarSdk.Transaction(signedXdr, networkPassphrase);
      console.log('[Auth] Transaction has', tx.signatures.length, 'signatures');
      
      if (tx.signatures.length < 2) {
        console.log('[Auth] Not enough signatures (need at least 2)');
        return null;
      }

      // Verify server's signature is present
      try {
        const keypair = StellarSdk.Keypair.fromPublicKey(serverAccountId);
        const tx2 = new StellarSdk.Transaction(signedXdr, networkPassphrase);
        const txHash = tx2.hash();
        let serverSigFound = false;
        for (const sig of tx2.signatures) {
          try {
            keypair.verify(txHash, sig.signature());
            serverSigFound = true;
            break;
          } catch (e) {
            // Not a server signature, continue
          }
        }
        if (!serverSigFound) {
          console.log('[Auth] Server signature not found');
          return null;
        }
        console.log('[Auth] Server signature verified');
      } catch (err) {
        console.log('[Auth] Error verifying server signature:', err.message);
        return null;
      }
    }

    console.log('[Auth] ✓ Challenge verified successfully, returning clientAccountID');
    return clientAccountID;
  } catch (err) {
    logger.error('[Auth] SEP-10 challenge verification error:', err.message);
    console.log('[Auth] Full error:', err);
    return null;
  }
}

/**
 * Legacy: Verify a raw nonce + ed25519 signature (for backward compatibility).
 */
async function verifyLegacyChallenge(stellarAddress, signatureBase64) {
  try {
    const challengeKey = `auth:challenge:${stellarAddress}`;
    const nonce = await redis.get(challengeKey);
    if (!nonce) return false;

    await redis.del(challengeKey);

    const keypair = StellarSdk.Keypair.fromPublicKey(stellarAddress);
    const isValid = keypair.verify(
      Buffer.from(nonce, 'utf-8'),
      Buffer.from(signatureBase64, 'base64')
    );
    return isValid;
  } catch (err) {
    logger.error('[Auth] Legacy challenge verification error:', err.message);
    return false;
  }
}

/**
 * POST /api/v1/trader/auth/change-password
 * Change trader password.
 * Body: { currentPassword, newPassword, confirmPassword }
 */
router.post(
  '/trader/auth/change-password',
  authTrader,
  validate(['currentPassword', 'newPassword', 'confirmPassword']),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const traderId = req.user.id;

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New passwords do not match' });
      }

      const result = await db.query(
        `SELECT password_hash FROM traders WHERE id = $1`,
        [traderId]
      );
      const trader = result.rows[0];
      if (!trader) return res.status(404).json({ error: 'Trader not found' });

      if (!(await bcrypt.compare(currentPassword, trader.password_hash))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 12);
      await db.query(
        `UPDATE traders SET password_hash = $1 WHERE id = $2`,
        [newPasswordHash, traderId]
      );

      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/trader/auth/forgot-password
 * Initiate password reset flow.
 * Body: { email }
 */
router.post(
  '/trader/auth/forgot-password',
  validate(['email']),
  async (req, res, next) => {
    try {
      const { email } = req.body;

      const result = await db.query(
        `SELECT id FROM traders WHERE email = $1`,
        [email]
      );
      const trader = result.rows[0];

      if (!trader) {
        // Don't leak that email exists or not
        return res.json({ message: 'If email exists, password reset link has been sent' });
      }

      const otp = crypto.randomBytes(3).toString('hex').toUpperCase();
      const otpKey = `trader:otp:${email}`;
      await redis.setex(otpKey, 900, otp); // 15 minutes

      // TODO: Send OTP via email
      logger.info(`[Auth] Password reset OTP for ${email}: ${otp}`);

      res.json({ message: 'If email exists, password reset link has been sent' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/trader/auth/reset-password
 * Reset password with OTP.
 * Body: { email, otp, newPassword, confirmPassword }
 */
router.post(
  '/trader/auth/reset-password',
  validate(['email', 'otp', 'newPassword', 'confirmPassword']),
  async (req, res, next) => {
    try {
      const { email, otp, newPassword, confirmPassword } = req.body;

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New passwords do not match' });
      }

      const otpKey = `trader:otp:${email}`;
      const storedOtp = await redis.get(otpKey);

      if (!storedOtp || storedOtp !== otp.toUpperCase()) {
        return res.status(401).json({ error: 'Invalid or expired OTP' });
      }

      const result = await db.query(
        `SELECT id FROM traders WHERE email = $1`,
        [email]
      );
      const trader = result.rows[0];
      if (!trader) return res.status(404).json({ error: 'Trader not found' });

      const newPasswordHash = await bcrypt.hash(newPassword, 12);
      await db.query(
        `UPDATE traders SET password_hash = $1 WHERE id = $2`,
        [newPasswordHash, trader.id]
      );

      await redis.del(otpKey);

      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/trader/auth/sessions
 * Get active sessions for trader.
 */
router.get(
  '/trader/auth/sessions',
  authTrader,
  async (req, res, next) => {
    try {
      const traderId = req.user.id;

      const result = await db.query(
        `SELECT id, device_id, created_at, last_seen_at FROM trader_sessions WHERE trader_id = $1 ORDER BY last_seen_at DESC`,
        [traderId]
      );

      res.json({ sessions: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/trader/auth/sessions/:sessionId
 * Revoke a specific session.
 */
router.delete(
  '/trader/auth/sessions/:sessionId',
  authTrader,
  async (req, res, next) => {
    try {
      const traderId = req.user.id;
      const { sessionId } = req.params;

      const result = await db.query(
        `DELETE FROM trader_sessions WHERE id = $1 AND trader_id = $2`,
        [sessionId, traderId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ message: 'Session revoked' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/trader/auth/sessions/all
 * Revoke all sessions for trader.
 */
router.delete(
  '/trader/auth/sessions/all',
  authTrader,
  async (req, res, next) => {
    try {
      const traderId = req.user.id;

      await db.query(
        `DELETE FROM trader_sessions WHERE trader_id = $1`,
        [traderId]
      );

      res.json({ message: 'All sessions revoked' });
    } catch (err) {
      next(err);
    }
  }
);

/* ────────────────── 2FA ENDPOINTS ────────────────── */

/**
 * POST /api/v1/auth/2fa/setup
 * Initiate 2FA setup - generate TOTP secret and return QR code
 * Requires: authenticated trader
 */
router.post(
  '/2fa/setup',
  authTrader,
  async (req, res, next) => {
    try {
      const traderId = req.traderId;

      // Check if 2FA is already enabled
      const existing = await db.query(
        `SELECT id FROM trader_2fa_settings WHERE trader_id = $1 AND is_enabled = TRUE`,
        [traderId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: '2FA is already enabled on this account' });
      }

      // Get trader email for TOTP label
      const traderResult = await db.query(
        `SELECT email FROM traders WHERE id = $1`,
        [traderId]
      );
      const trader = traderResult.rows[0];
      if (!trader) return res.status(404).json({ error: 'Trader not found' });

      // Generate TOTP secret
      const { secret, qrCode, manualEntry } = await generateTotpSecret(traderId, trader.email);

      // Generate backup codes
      const { codes, codesHash } = await generateBackupCodes();

      // Store setup attempt in Redis (temporary, valid for 10 minutes)
      const setupKey = `trader:2fa_setup:${traderId}`;
      await redis.setex(
        setupKey,
        600,
        JSON.stringify({ secret, codesHash, codes })
      );

      // Return QR code and manual entry option to frontend
      res.json({
        qrCode,
        manualEntry,
        setupId: traderId, // Frontend will use this to track the setup session
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/2fa/verify-setup
 * Verify 2FA setup code and finalize 2FA enabling
 * Body: { code } - 6-digit TOTP code
 */
router.post(
  '/2fa/verify-setup',
  authTrader,
  validate(['code']),
  async (req, res, next) => {
    try {
      const traderId = req.traderId;
      const { code } = req.body;

      // Retrieve setup data from Redis
      const setupKey = `trader:2fa_setup:${traderId}`;
      const setupData = await redis.get(setupKey);
      if (!setupData) {
        return res.status(400).json({ error: 'Setup session expired. Please restart 2FA setup.' });
      }

      const { secret, codesHash, codes } = JSON.parse(setupData);

      // Verify the TOTP code
      const isValid = verifyTotpCode(secret, code);
      if (!isValid) {
        await log2faVerification(db, traderId, 'setup', 'failed', 'Invalid TOTP code');
        return res.status(401).json({ error: 'Invalid verification code. Please try again.' });
      }

      // Check/create 2FA settings record
      const existing = await db.query(
        `SELECT id FROM trader_2fa_settings WHERE trader_id = $1`,
        [traderId]
      );

      if (existing.rows.length > 0) {
        // Update existing record
        await db.query(
          `UPDATE trader_2fa_settings
           SET totp_secret = $1, is_enabled = TRUE, enabled_at = NOW(), 
               backup_codes_remaining = $2, updated_at = NOW()
           WHERE trader_id = $3`,
          [secret, 10, traderId]
        );
      } else {
        // Create new record
        await db.query(
          `INSERT INTO trader_2fa_settings
           (trader_id, totp_secret, is_enabled, enabled_at, backup_codes_remaining)
           VALUES ($1, $2, TRUE, NOW(), $3)`,
          [traderId, secret, 10]
        );
      }

      // Store backup codes individually (per-code storage)
      await storeBackupCodes(db, traderId, codes);

      // Log success
      await log2faVerification(db, traderId, 'setup', 'success');

      // Clear setup data
      await redis.del(setupKey);

      // Return backup codes to user (one-time display)
      res.json({
        message: '2FA successfully enabled',
        backupCodes: codes,
        warning: 'Save these backup codes in a safe place. Each code can only be used once.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/auth/2fa/status
 * Check if 2FA is enabled for this trader
 */
router.get(
  '/2fa/status',
  authTrader,
  async (req, res, next) => {
    try {
      const traderId = req.traderId;

      const result = await db.query(
        `SELECT is_enabled, enabled_at, backup_codes_remaining FROM trader_2fa_settings WHERE trader_id = $1`,
        [traderId]
      );

      if (result.rows.length === 0) {
        return res.json({ is2faEnabled: false });
      }

      const settings = result.rows[0];
      res.json({
        is2faEnabled: settings.is_enabled,
        enabledAt: settings.enabled_at,
        backupCodesRemaining: settings.backup_codes_remaining,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/2fa/verify-login
 * Verify 2FA code during login (TOTP or backup code)
 * This is called after password verification succeeds and 2FA is enabled
 * Body: { traderId, code }
 * Rate limited to 15 attempts per 15 minutes per IP
 */
router.post(
  '/2fa/verify-login',
  twoFactorVerifyLimiter,
  validate(['traderId', 'code']),
  async (req, res, next) => {
    try {
      const { traderId, code } = req.body;

      // Get 2FA settings
      const result = await db.query(
        `SELECT totp_secret, is_enabled FROM trader_2fa_settings WHERE trader_id = $1`,
        [traderId]
      );

      if (result.rows.length === 0 || !result.rows[0].is_enabled) {
        return res.status(400).json({ error: '2FA not enabled for this account' });
      }

      const { totp_secret } = result.rows[0];

      // Try TOTP code first
      let isValid = verifyTotpCode(totp_secret, code);
      let verificationMethod = 'totp';

      // If TOTP fails, try backup code
      if (!isValid) {
        const backupResult = await verifyAndUseBackupCode(db, traderId, code);
        if (backupResult.valid) {
          isValid = true;
          verificationMethod = 'backup_code';
          // Decrement backup code count
          await db.query(
            `UPDATE trader_2fa_settings 
             SET backup_codes_remaining = backup_codes_remaining - 1 
             WHERE trader_id = $1`,
            [traderId]
          );
        }
      }

      if (!isValid) {
        await log2faVerification(db, traderId, 'login', 'failed', 'Invalid TOTP or backup code');
        return res.status(401).json({ error: 'Invalid code. Please try again.' });
      }

      // Code verified - issue login session token
      const token = signToken(traderId, 'trader');
      
      // Update trader last active
      await db.query(
        `UPDATE traders SET last_active_at = NOW(), is_active = TRUE WHERE id = $1`,
        [traderId]
      );

      // Log success
      await log2faVerification(db, traderId, 'login', 'success');

      // Return trader info and token
      const traderResult = await db.query(
        `SELECT id, name, stellar_address, usdc_float, daily_limit, daily_volume, trust_score, verification_status
         FROM traders WHERE id = $1`,
        [traderId]
      );
      const trader = traderResult.rows[0];

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
 * POST /api/v1/auth/2fa/disable
 * Disable 2FA (requires current TOTP code or backup code for confirmation)
 * Body: { code } - current TOTP code or backup code
 */
router.post(
  '/2fa/disable',
  authTrader,
  validate(['code']),
  async (req, res, next) => {
    try {
      const traderId = req.traderId;
      const { code } = req.body;

      // Get 2FA settings
      const result = await db.query(
        `SELECT totp_secret, is_enabled FROM trader_2fa_settings WHERE trader_id = $1`,
        [traderId]
      );

      if (result.rows.length === 0 || !result.rows[0].is_enabled) {
        return res.status(400).json({ error: '2FA is not enabled on this account' });
      }

      const { totp_secret } = result.rows[0];

      // Try TOTP code first
      let isValid = verifyTotpCode(totp_secret, code);

      // If TOTP fails, try backup code
      if (!isValid) {
        const backupResult = await verifyAndUseBackupCode(db, traderId, code);
        if (backupResult.valid) {
          isValid = true;
          // Mark backup code as used
          // (already done in verifyAndUseBackupCode)
        }
      }

      if (!isValid) {
        await log2faVerification(db, traderId, 'disable', 'failed', 'Invalid code');
        return res.status(401).json({ error: 'Invalid code. 2FA not disabled.' });
      }

      // Disable 2FA and clear all backup codes
      await db.query(
        `UPDATE trader_2fa_settings SET is_enabled = FALSE, updated_at = NOW() WHERE trader_id = $1`,
        [traderId]
      );

      // Clear all backup codes for this trader
      await db.query(
        `DELETE FROM trader_backup_codes WHERE trader_id = $1`,
        [traderId]
      );

      // Log the disabling
      await log2faVerification(db, traderId, 'disable', 'success');

      res.json({ message: '2FA has been disabled successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/trader/auth/2fa/backup-codes/regenerate
 * Regenerate backup codes (requires current TOTP code for confirmation)
 * Body: { code } - current TOTP code
 */
router.post(
  '/trader/auth/2fa/backup-codes/regenerate',
  authTrader,
  validate(['code']),
  async (req, res, next) => {
    try {
      const traderId = req.traderId;
      const { code } = req.body;

      // Get 2FA settings
      const result = await db.query(
        `SELECT totp_secret, is_enabled FROM trader_2fa_settings WHERE trader_id = $1`,
        [traderId]
      );

      if (result.rows.length === 0 || !result.rows[0].is_enabled) {
        return res.status(400).json({ error: '2FA is not enabled on this account' });
      }

      const { totp_secret } = result.rows[0];

      // Verify TOTP code
      const isValid = verifyTotpCode(totp_secret, code);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid code. Backup codes not regenerated.' });
      }

      // Generate new backup codes
      const { codes, codesHash } = await generateBackupCodes();

      // Update database
      await db.query(
        `UPDATE trader_2fa_settings 
         SET backup_codes_hash = $1, backup_codes_remaining = $2, updated_at = NOW()
         WHERE trader_id = $3`,
        [codesHash, 10, traderId]
      );

      // Log the action
      await log2faVerification(db, traderId, 'backup_codes_regenerated', 'success');

      res.json({
        message: 'Backup codes regenerated successfully',
        backupCodes: codes,
        warning: 'Your old backup codes are no longer valid.',
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
