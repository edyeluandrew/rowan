import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Shared ioredis options for app client + Bull.
 *
 * Render Key Value / Valkey often drops idle TCP clients (ECONNRESET). Without
 * keepAlive + retry strategy this floods logs. Also ~9 Bull queues each open
 * multiple sockets — free tier connection limits close sockets right after
 * connect (Connected → Connection closed loop).
 *
 * @param {string} [url]
 * @param {{ forBull?: boolean }} [opts]
 *   forBull: Bull requires maxRetriesPerRequest:null AND enableReadyCheck:false
 *   on subscriber/bclient (see OptimalBits/bull#1873).
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
  // Render Key Value often uses username "default" with a password
  let username;
  if (parsed.username) {
    username = decodeURIComponent(parsed.username);
  }

  const forBull = !!opts.forBull;

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    password: password || undefined,
    username: username || undefined,
    family: 4,
    connectTimeout: 10_000,
    keepAlive: 10_000,
    maxRetriesPerRequest: null,
    // Bull bclient/subscriber crash if enableReadyCheck is true
    enableReadyCheck: forBull ? false : true,
    // Avoid hanging forever on commands while the socket is storming reconnects.
    // Callers that need durability can retry; boot/health must fail fast.
    enableOfflineQueue: forBull ? true : false,
    lazyConnect: false,
    tls: url.startsWith('rediss://')
      ? { rejectUnauthorized: false }
      : undefined,
    retryStrategy(times) {
      // Cap retries visually; never give up (Render free redis restarts)
      if (times > 50) {
        return 10_000;
      }
      const delay = Math.min(500 * times, 5_000);
      if (times <= 3 || times % 20 === 0) {
        logger.warn(`[Redis] Reconnecting... attempt ${times} (next in ${delay}ms)`);
      }
      return delay;
    },
    reconnectOnError(err) {
      const msg = err?.message || '';
      if (/READONLY|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|NR_CLOSED/i.test(msg)) {
        return 1;
      }
      return false;
    },
  };
}

/** Options object for Bull createClient (must enableReadyCheck:false). */
export function buildBullRedisOptions(url = config.redisUrl) {
  return buildRedisOptions(url, { forBull: true });
}

/**
 * Bounded Redis command — never hangs boot if redis is flapping.
 * @param {import('ioredis').default} client
 * @param {number} [ms]
 */
export async function redisPingWithTimeout(client, ms = 2_000) {
  return Promise.race([
    client.ping(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`redis ping timeout after ${ms}ms`)), ms)
    ),
  ]);
}

const redis = new Redis(buildRedisOptions());

let lastConnectLog = 0;
let lastCloseLog = 0;
redis.on('connect', () => {
  const now = Date.now();
  if (now - lastConnectLog > 30_000) {
    logger.info('[Redis] Connected');
    lastConnectLog = now;
  }
});
redis.on('ready', () => logger.info('[Redis] Ready'));
redis.on('close', () => {
  const now = Date.now();
  if (now - lastCloseLog > 30_000) {
    logger.warn('[Redis] Connection closed');
    lastCloseLog = now;
  }
});
redis.on('error', (err) => {
  const msg = err?.message || String(err);
  if (/ECONNRESET|EPIPE|Connection is closed|connect ETIMEDOUT|ENOTFOUND/i.test(msg)) {
    return; // expected while reconnecting — avoid log floods that look like a crash loop
  }
  logger.error('[Redis] Error:', { error: msg });
});

export default redis;
