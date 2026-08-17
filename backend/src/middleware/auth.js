import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import kycTierService from '../services/kyc/kycTierService.js';
import logger from '../utils/logger.js';
import db from '../db/index.js';
import quoteEngine from '../services/quoteEngine.js';
import { isDenied } from '../services/tokenDenylist.js';

/**
 * Authenticate wallet users via JWT.
 * Expects: Authorization: Bearer <token>
 */
export function authUser(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    if (payload.role !== 'user') return res.status(403).json({ error: 'Not a user token' });
    req.userId = payload.sub;
    req.deviceId = payload.deviceId;
    ensureActiveAccount('user', payload.sub)
      .then(async (active) => {
        if (!active) return res.status(403).json({ error: 'Account disabled' });
        if (await isDenied(token)) return res.status(401).json({ error: 'Session ended' });
        next();
      })
      .catch(() => res.status(500).json({ error: 'Authentication check failed' }));
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Authenticate OTC traders via JWT + optional device binding.
 */
export function authTrader(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    if (payload.role !== 'trader') return res.status(403).json({ error: 'Not a trader token' });
    
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token: missing trader ID' });
    }
    
    req.traderId = payload.sub;
    req.deviceId = payload.deviceId;
    ensureActiveTrader(payload.sub)
      .then(async (active) => {
        if (!active) return res.status(403).json({ error: 'Account disabled or suspended' });
        if (await isDenied(token)) return res.status(401).json({ error: 'Session ended' });
        next();
      })
      .catch(() => res.status(500).json({ error: 'Authentication check failed' }));
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Authenticate admins.
 */
export function authAdmin(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Not an admin token' });
    req.adminId = payload.sub;
    ensureActiveAccount('admin', payload.sub)
      .then(async (active) => {
        if (!active) return res.status(403).json({ error: 'Admin account disabled' });
        if (await isDenied(token)) return res.status(401).json({ error: 'Session ended' });
        next();
      })
      .catch(() => res.status(500).json({ error: 'Authentication check failed' }));
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Generate a JWT for a given subject and role.
 * Admin tokens use a shorter TTL in production (JWT_ADMIN_EXPIRES_IN).
 */
export function signToken(sub, role, deviceId = null) {
  const expiresIn = role === 'admin'
    ? config.jwt.adminExpiresIn
    : role === 'trader'
      ? config.jwt.traderExpiresIn
      : config.jwt.expiresIn;

  return jwt.sign(
    { sub, role, deviceId },
    config.jwt.secret,
    { algorithm: 'HS256', expiresIn }
  );
}

async function ensureActiveAccount(role, userId) {
  const result = await db.query(
    `SELECT is_active FROM users WHERE id = $1 AND role = $2`,
    [userId, role]
  );
  return result.rows[0]?.is_active === true;
}

async function ensureActiveTrader(traderId) {
  const result = await db.query(
    `SELECT is_active, is_suspended FROM traders WHERE id = $1`,
    [traderId]
  );
  const row = result.rows[0];
  if (!row) return false;
  return row.is_active === true && row.is_suspended !== true;
}

/**
 * @deprecated Prefer enforceKycTransactionLimits from middleware/kycLimits.js
 */
export async function checkUserLimits(req, res, next) {
  try {
    const network = req.body?.network;
    const fiatCurrency = network ? quoteEngine.networkToFiat(network) : 'UGX';
    const countryCode = network ? kycTierService.networkToCountryCode(network) : null;

    let fiatEstimate = null;
    if (req.body.fiatAmount != null && req.body.fiatAmount !== '') {
      fiatEstimate = parseFloat(req.body.fiatAmount);
    } else if (req.body.xlmAmount != null && req.body.xlmAmount !== '') {
      const rate = await quoteEngine.getLegacyXlmRate(fiatCurrency);
      fiatEstimate = parseFloat(req.body.xlmAmount) * rate;
    }

    if (fiatEstimate != null && Number.isFinite(fiatEstimate)) {
      const check = await kycTierService.checkTransactionLimits(
        req.userId,
        fiatEstimate,
        fiatCurrency,
        { countryCode }
      );
      if (!check.allowed) {
        return res.status(400).json({ error: check.reason, code: check.code });
      }
      req.kycLimits = check.limits;
    }

    const userResult = await db.query(`SELECT * FROM users WHERE id = $1`, [req.userId]);
    req.user = userResult.rows[0];
    if (!req.user) return res.status(404).json({ error: 'User not found' });
    next();
  } catch (err) {
    logger.error('[Auth] Limit check error:', err.message);
    return res.status(500).json({ error: 'Internal error during limit check' });
  }
}

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export { extractToken };
