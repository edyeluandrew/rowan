import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

const skipInDev = config.nodeEnv === 'development';

/** Admin email/password login — per email + IP */
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimits.adminLoginMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipInDev,
  keyGenerator: (req) => `${req.ip}:${req.body?.email || 'unknown'}`,
  message: { error: 'Too many admin login attempts. Please try again later.' },
});

/** Admin / trader / wallet 2FA verify — per IP */
export const twoFactorVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimits.twoFactorVerifyMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipInDev,
  message: { error: 'Too many 2FA attempts. Please try again later.' },
});

/** Trader password login */
export const traderLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimits.traderLoginMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipInDev,
  keyGenerator: (req) => `${req.ip}:${req.body?.email || 'unknown'}`,
  message: { error: 'Too many login attempts. Please try again later.' },
});

/** Cashout status polling */
export const cashoutStatusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimits.cashoutStatusMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipInDev,
  message: { error: 'Too many status requests. Please slow down.' },
});

/** Sensitive settlement / dispute actions */
export const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimits.sensitiveActionMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipInDev,
  keyGenerator: (req) => req.userId || req.traderId || req.adminId || req.ip,
  message: { error: 'Too many requests for this action. Please try again later.' },
});
