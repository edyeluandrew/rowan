import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  tls: config.redisUrl?.startsWith('rediss://') ? {} : undefined,
});

redis.on('connect', () => logger.info('[Redis] Connected'));
redis.on('error', (err) => logger.error('[Redis] Error:', { error: err.message }));

export default redis;
