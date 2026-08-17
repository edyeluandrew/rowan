import crypto from 'crypto';
import redis from '../db/redis.js';
import logger from '../utils/logger.js';

function fingerprint(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function denyToken(token, expUnix) {
  if (!token) return;
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(1, Number(expUnix || 0) - now);
  try {
    await redis.set(`jwt:deny:${fingerprint(token)}`, '1', 'EX', ttl);
  } catch (err) {
    logger.warn(`[Auth] Could not denylist token: ${err.message}`);
  }
}

export async function isDenied(token) {
  if (!token) return false;
  try {
    const hit = await redis.get(`jwt:deny:${fingerprint(token)}`);
    return hit === '1';
  } catch (err) {
    logger.warn(`[Auth] Denylist lookup failed (allowing token): ${err.message}`);
    return false;
  }
}
