import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import db from '../db/index.js';
import { fiatToUgx } from '../utils/financial.js';

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
    next();
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
    req.traderId = payload.sub;
    req.deviceId = payload.deviceId;
    next();
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
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Generate a JWT for a given subject and role.
 */
export function signToken(sub, role, deviceId = null) {
  return jwt.sign(
    { sub, role, deviceId },
    config.jwt.secret,
    { algorithm: 'HS256', expiresIn: config.jwt.expiresIn }
  );
}

/**
 * Verify per-transaction limits and daily limits for a user.
 * [H-3 FIX] Normalizes multi-currency transactions to UGX equivalent.
 */
export async function checkUserLimits(req, res, next) {
  try {
    const userResult = await db.query(`SELECT * FROM users WHERE id = $1`, [req.userId]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });

    const xlmAmount = parseFloat(req.body.xlmAmount);

    // Per-transaction limit (XLM)
    if (xlmAmount > parseFloat(user.per_tx_limit)) {
      return res.status(400).json({
        error: `Exceeds per-transaction limit of ${user.per_tx_limit} XLM`,
      });
    }

    // ── [H-3 FIX] Daily limit — sum fiat moved today, normalized to UGX ──
    const dailyResult = await db.query(
      `SELECT fiat_amount, fiat_currency
       FROM transactions
       WHERE user_id = $1
         AND state NOT IN ('FAILED', 'REFUNDED')
         AND created_at >= CURRENT_DATE`,
      [req.userId]
    );

    let dailyTotalUgx = 0;
    for (const row of dailyResult.rows) {
      dailyTotalUgx += fiatToUgx(parseFloat(row.fiat_amount), row.fiat_currency);
    }

    // Estimate this request's fiat in UGX for comparison
    const quoteEngine = (await import('../services/quoteEngine.js')).default;
    const network = req.body.network;
    const fiatCurrency = quoteEngine.networkToFiat(network);
    // [PHASE 2 UPGRADE] Use legacy rate for daily limit check
    const currentRate = await quoteEngine.getLegacyXlmRate(fiatCurrency);
    const estimatedFiat = xlmAmount * currentRate;
    const estimatedUgx = fiatToUgx(estimatedFiat, fiatCurrency);

    const dailyLimitUgx = parseFloat(user.daily_limit_ugx || 500000);
    if (dailyTotalUgx + estimatedUgx > dailyLimitUgx) {
      return res.status(400).json({
        error: `Exceeds daily limit of ${dailyLimitUgx} UGX (used today: ${Math.round(dailyTotalUgx)} UGX)`,
      });
    }

    req.user = user;
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
