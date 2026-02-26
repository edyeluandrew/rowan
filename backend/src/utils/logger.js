/**
 * Structured Logger — Batch 10 audit fix.
 *
 * Replaces raw console.log/warn/error with structured JSON output
 * in production, and human-readable prefixed output in development.
 *
 * Usage:
 *   import logger from '../utils/logger.js';
 *   logger.info('Server started', { port: 4000 });
 *   logger.warn('Slow query', { duration: 1200 });
 *   logger.error('DB failed', { err: error.message });
 */

import config from '../config/index.js';

const isProduction = config.nodeEnv === 'production';

function formatMessage(level, message, meta = {}) {
  if (isProduction) {
    // Structured JSON for log aggregators (CloudWatch, Datadog, etc.)
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    return JSON.stringify(entry);
  }

  // Human-readable for development
  const prefix = `[${level.toUpperCase()}]`;
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${prefix} ${message}${metaStr}`;
}

function info(message, meta) {
  console.log(formatMessage('info', message, meta));
}

function warn(message, meta) {
  console.warn(formatMessage('warn', message, meta));
}

function error(message, meta) {
  console.error(formatMessage('error', message, meta));
}

function debug(message, meta) {
  if (!isProduction) {
    console.log(formatMessage('debug', message, meta));
  }
}

export default { info, warn, error, debug };
