import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Shared ioredis options for app client + Bull.
 *
 * Render Key Value / Valkey often drops idle TCP clients (ECONNRESET). Without
 * keepAlive + retry strategy this floods logs and can flop /health mid-deploy
 * when ~9 Bull queues each open multiple connections to the same instance.
 *
 * @param {string} [url]
 * @param {{ forBull?: boolean }} [opts]
 *   forBull: Bull requires maxRetriesPerRequest:null AND enableReadyCheck:false
 *   on subscriber/bclient (see OptimalBits/bull#1873). App client can ready-check.
 */
export function buildRedisOptions(url = config.redisUrl, opts = {}) {
  if (!url) {
    throw new Error('REDIS_URL is not set');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid REDIS_URL: ${url}`);
  }

  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
  const username =
    parsed.username && parsed.username !== 'default'
      ? decodeURIComponent(parsed.username)
      : undefined;

  const forBull = !!opts.forBull;

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    password: password || undefined,
    username: username || undefined,
    // Prefer IPv4 — dual-stack DNS on Render can contribute to flaky resets
    family: 4,
    connectTimeout: 15_000,
    // TCP keepalive so the idle connection is less likely to be severed
    keepAlive: 10_000,
    // Required for Bull (and safer for command retry after reconnect)
    maxRetriesPerRequest: null,
    // Bull bclient/subscriber crash if enableReadyCheck is true
    enableReadyCheck: forBull ? false : true,
    enableOfflineQueue: true,
    // rediss:// = TLS (Render external URL). Internal redis:// has no TLS.
    tls: url.startsWith('rediss://')
      ? { rejectUnauthorized: false }
      : undefined,
    retryStrategy(times) {
      const delay = Math.min(200 + times * 200, 5_000);
      // Throttle reconnect spam (attempt 100+ is normal noise without this)
      if (times <= 5 || times % 25 === 0) {
        logger.warn(`[Redis] Reconnecting... attempt ${times} (next in ${delay}ms)`);
      }
      return delay;
    },
    reconnectOnError(err) {
      const msg = err?.message || '';
      // Reconnect on common provider blips; return 1 = reconnect, 2 = reconnect + resend
      if (/READONLY|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|NR_CLOSED/i.test(msg)) {
        return 1;
      }
      return false;
    },
  };
}

/** Options object safe to pass to `new Queue(..., { redis: ... })`. */
export function buildBullRedisOptions(url = config.redisUrl) {
  return buildRedisOptions(url, { forBull: true });
}

const redis = new Redis(buildRedisOptions());

redis.on('connect', () => logger.info('[Redis] Connected'));
redis.on('ready', () => logger.info('[Redis] Ready'));
redis.on('close', () => logger.warn('[Redis] Connection closed'));
redis.on('error', (err) => {
  // ECONNRESET is expected on free/shared Render KV — keep noisy at warn after flood risk
  const msg = err?.message || String(err);
  if (/ECONNRESET|EPIPE|Connection is closed/i.test(msg)) {
    if (Math.random() < 0.1) {
      logger.warn('[Redis] Transient disconnect', { error: msg });
    }
  } else {
    logger.error('[Redis] Error:', { error: msg });
  }
});

export default redis;
