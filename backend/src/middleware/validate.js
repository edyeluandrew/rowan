// [P5 FIX] Enhanced input validation with type/range/format checks
import logger from '../utils/logger.js';

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_HASH_RE = /^[a-f0-9]{64}$/i; // SHA-256 hex
const MOBILE_NETWORKS = ['MPESA_KE', 'MTN_UG', 'AIRTEL_UG', 'MTN_TZ', 'AIRTEL_TZ'];

/**
 * Validate required fields on the request body.
 * Usage: validate(['xlmAmount', 'network', 'phoneHash'])
 */
export function validate(requiredFields) {
  return (req, res, next) => {
    const missing = requiredFields.filter((f) => {
      const val = req.body[f];
      return val === undefined || val === null || val === '';
    });

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }
    next();
  };
}

/**
 * Validate field types and ranges.
 * Usage: validateTypes({ xlmAmount: 'positiveNumber', network: 'mobileNetwork', stellarAddress: 'stellarAddress' })
 */
export function validateTypes(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(schema)) {
      const val = req.body[field];
      if (val === undefined || val === null) continue; // use validate() for required checks

      switch (rule) {
        case 'positiveNumber':
          // Accept both number and numeric string
          const numVal = typeof val === 'string' ? parseFloat(val) : val;
          if (!Number.isFinite(numVal) || numVal <= 0) {
            errors.push(`${field} must be a positive number (got: ${val})`);
          }
          break;
        case 'nonNegativeNumber':
          // Accept both number and numeric string
          const nnVal = typeof val === 'string' ? parseFloat(val) : val;
          if (!Number.isFinite(nnVal) || nnVal < 0) {
            errors.push(`${field} must be a non-negative number (got: ${val})`);
          }
          break;
        case 'stellarAddress':
          if (typeof val !== 'string' || !STELLAR_ADDRESS_RE.test(val)) {
            errors.push(`${field} must be a valid Stellar address (G...)`);
          }
          break;
        case 'email':
          if (typeof val !== 'string' || !EMAIL_RE.test(val)) {
            errors.push(`${field} must be a valid email address`);
          }
          break;
        case 'phoneHash':
          if (typeof val !== 'string' || !PHONE_HASH_RE.test(val)) {
            errors.push(`${field} must be a SHA-256 hex string`);
          }
          break;
        case 'mobileNetwork':
          if (typeof val !== 'string' || !MOBILE_NETWORKS.includes(val.toUpperCase())) {
            errors.push(`${field} must be one of: ${MOBILE_NETWORKS.join(', ')}`);
          }
          break;
        case 'string':
          if (typeof val !== 'string' || val.length > 1000) {
            errors.push(`${field} must be a string (max 1000 chars)`);
          }
          break;
        case 'uuid':
          if (typeof val !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
            errors.push(`${field} must be a valid UUID`);
          }
          break;
        default:
          break;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }
    next();
  };
}

/**
 * Global error handler.
 * [AUDIT FIX] Never leak internal error messages to clients in production.
 */
export function errorHandler(err, req, res, _next) {
  logger.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);
  const status = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(status).json({
    error: status >= 500 && isProduction
      ? 'Internal server error'
      : (err.message || 'Internal server error'),
  });
}
