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

// [AUDIT FIX] In production, default log level is 'warn' — only warn and error output.
// Override with LOG_LEVEL=info to enable info logs in production if needed.
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'warn' : 'debug');
const LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };
const minPriority = LEVEL_PRIORITY[logLevel] ?? 0;

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
  if (minPriority > LEVEL_PRIORITY.info) return;
  console.log(formatMessage('info', message, meta));
}

function warn(message, meta) {
  if (minPriority > LEVEL_PRIORITY.warn) return;
  console.warn(formatMessage('warn', message, meta));
}

function error(message, meta) {
  console.error(formatMessage('error', message, meta));
}

function debug(message, meta) {
  if (minPriority > LEVEL_PRIORITY.debug) return;
  console.log(formatMessage('debug', message, meta));
}

export default { info, warn, error, debug };
