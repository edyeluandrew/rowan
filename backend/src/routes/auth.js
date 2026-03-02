import { Router } from 'express';
import crypto from 'crypto';
import { signToken, authAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import redis from '../db/redis.js';
import bcrypt from 'bcryptjs';
import { StellarSdk } from '../config/stellar.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/auth/challenge
 * [C1 FIX] Issue a cryptographic challenge nonce for Stellar signature auth.
 * The wallet must sign this nonce with its private key and return it to /login.
 * Query: ?stellarAddress=G...
 */
router.get('/challenge', async (req, res, next) => {
  try {
    const { stellarAddress } = req.query;
    if (!stellarAddress || !stellarAddress.startsWith('G') || stellarAddress.length !== 56) {
      return res.status(400).json({ error: 'Valid Stellar public key (G...) required' });
    }

    // Generate a random nonce, store in Redis with 5-minute TTL
    const nonce = crypto.randomBytes(32).toString('hex');
    const challengeKey = `auth:challenge:${stellarAddress}`;
    await redis.set(challengeKey, nonce, 'EX', 300);

    res.json({
      challenge: nonce,
      stellarAddress,
      expiresIn: 300,
      message: 'Sign this challenge with your Stellar private key and POST to /auth/login',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/register
 * Register a new wallet user.
 * [C1 FIX] Requires a signed challenge to prove key ownership.
 * Body: { stellarAddress, phoneHash, signature, deviceId? }
 */
router.post(
  '/register',
  validate(['stellarAddress', 'phoneHash', 'signature']),
  async (req, res, next) => {
    try {
      const { stellarAddress, phoneHash, signature, deviceId } = req.body;

      // Verify the challenge signature
      const verified = await verifyChallenge(stellarAddress, signature);
      if (!verified) {
        return res.status(401).json({ error: 'Invalid or expired challenge signature' });
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
 * POST /api/v1/auth/login
 * [C1 FIX] User login via Stellar address + cryptographic signature verification.
 * Body: { stellarAddress, signature, deviceId? }
 */
router.post(
  '/login',
  validate(['stellarAddress', 'signature']),
  async (req, res, next) => {
    try {
      const { stellarAddress, signature, deviceId } = req.body;

      // Verify the challenge signature
      const verified = await verifyChallenge(stellarAddress, signature);
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
 * Verify a Stellar challenge-response signature.
 * Returns true if the signature is valid for the stored nonce.
 */
async function verifyChallenge(stellarAddress, signatureBase64) {
  try {
    const challengeKey = `auth:challenge:${stellarAddress}`;
    const nonce = await redis.get(challengeKey);
    if (!nonce) return false; // expired or never issued

    // Delete the nonce immediately (single-use)
    await redis.del(challengeKey);

    // Verify ed25519 signature
    const keypair = StellarSdk.Keypair.fromPublicKey(stellarAddress);
    const isValid = keypair.verify(
      Buffer.from(nonce, 'utf-8'),
      Buffer.from(signatureBase64, 'base64')
    );
    return isValid;
  } catch (err) {
    logger.error('[Auth] Challenge verification error:', err.message);
    return false;
  }
}

export default router;
