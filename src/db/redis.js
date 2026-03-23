import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,   // never throw MaxRetriesPerRequestError
  retryStrategy(times) {
    const delay = Math.min(times * 500, 5000);
    logger.warn(`[Redis] Reconnecting... attempt ${times} (next in ${delay}ms)`);
    return delay;
  },
  reconnectOnError(err) {
    // Reconnect on READONLY errors (e.g. failover)
    return err.message.includes('READONLY');
  },
  tls: config.redisUrl?.startsWith('rediss://') ? {} : undefined,
  lazyConnect: false,
  enableOfflineQueue: true,
});

redis.on('connect', () => logger.info('[Redis] Connected'));
redis.on('error', (err) => logger.error('[Redis] Error:', { error: err.message }));

export default redis;
