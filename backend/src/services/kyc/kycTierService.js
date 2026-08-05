/**
 * Phase 2 A4 — Tiered KYC product rules + limit resolution.
 * Combines global config, per-country registry (E1), and user kyc_level.
 */

import db from '../../db/index.js';
import config from '../../config/index.js';
import countryService from '../countries/countryService.js';
import { fiatToUgx, getFiatToUgxRate } from '../../utils/financial.js';

const TIER_RANK = { NONE: 1, BASIC: 2, VERIFIED: 3 };

/** Minimum KYC level required to use a product feature. */
export const KYC_PRODUCTS = {
  offramp: 'NONE',
  onramp: 'NONE',
  express: 'NONE',
  airtime: 'NONE',
  utilities: 'NONE',
  savings: 'BASIC',
  virtual_card: 'VERIFIED',
};

export function networkToCountryCode(network) {
  const code = String(network || '').trim().toUpperCase();
  const match = code.match(/_(UG|KE|TZ|RW)$/);
  if (match) return match[1];
  if (code.includes('MPESA')) return 'KE';
  return 'UG';
}

export function canAccessProduct(kycLevel, product) {
  const required = KYC_PRODUCTS[product] || 'NONE';
  const userRank = TIER_RANK[kycLevel] || 1;
  const requiredRank = TIER_RANK[required] || 1;
  return userRank >= requiredRank;
}

function usdToUgx(usd) {
  const rate = config.usdcFiatRates?.UGX || 3750;
  return Math.floor(Number(usd) * rate);
}

/**
 * Resolve effective per-tx and daily limits (UGX) for a user in a corridor.
 */
export function resolveLimits(user, countryCode) {
  const level = user?.kyc_level || 'NONE';
  const country = countryCode ? countryService.getCountry(countryCode) : null;
  const kycConfig = country?.kycConfig || {};
  const configLimits = config.kycLimits[level] || config.kycLimits.NONE;

  let dailyUgx;
  if (level === 'VERIFIED') {
    const tier3Usd = kycConfig.tier3_daily_usd;
    dailyUgx = tier3Usd != null ? usdToUgx(tier3Usd) : configLimits.daily;
  } else if (level === 'BASIC') {
    dailyUgx = usdToUgx(kycConfig.tier2_daily_usd ?? 1000);
  } else {
    dailyUgx = usdToUgx(kycConfig.tier1_daily_usd ?? 50);
  }

  dailyUgx = Math.min(dailyUgx, configLimits.daily);

  if (user?.daily_limit_ugx != null && level !== 'NONE') {
    const adminCap = parseInt(user.daily_limit_ugx, 10);
    if (Number.isFinite(adminCap) && adminCap > 0) {
      dailyUgx = Math.min(dailyUgx, adminCap);
    }
  }

  const perTxUgx = Math.min(configLimits.perTx, dailyUgx);

  return {
    kycLevel: level,
    countryCode: country?.code || countryCode || null,
    perTxUgx,
    dailyUgx,
    tierLabel: level === 'VERIFIED' ? 'Tier 3' : level === 'BASIC' ? 'Tier 2' : 'Tier 1',
    products: Object.fromEntries(
      Object.entries(KYC_PRODUCTS).map(([product, required]) => [
        product,
        canAccessProduct(level, product),
      ])
    ),
  };
}

async function getDailyVolumeUgx(userId) {
  const kesRate = getFiatToUgxRate('KES');
  const tzsRate = getFiatToUgxRate('TZS');
  const rwfRate = getFiatToUgxRate('RWF');

  const dailyResult = await db.query(
    `SELECT COALESCE(SUM(
       CASE fiat_currency
         WHEN 'KES' THEN fiat_amount * $2
         WHEN 'TZS' THEN fiat_amount * $3
         WHEN 'RWF' THEN fiat_amount * $4
         ELSE fiat_amount
       END
     ), 0) AS daily_total_ugx
     FROM transactions
     WHERE user_id = $1
       AND state NOT IN ('FAILED', 'REFUNDED')
       AND created_at >= CURRENT_DATE`,
    [userId, kesRate, tzsRate, rwfRate]
  );

  return parseFloat(dailyResult.rows[0].daily_total_ugx) || 0;
}

/**
 * Check amount against tier limits. Returns { allowed, reason?, limits?, dailyUsedUgx? }.
 */
export async function checkTransactionLimits(userId, fiatAmount, fiatCurrency, options = {}) {
  const { countryCode, product } = options;

  const userResult = await db.query(
    `SELECT id, kyc_level, daily_limit_ugx, is_active FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return { allowed: false, reason: 'User not found', code: 'USER_NOT_FOUND' };
  if (!user.is_active) return { allowed: false, reason: 'Account disabled', code: 'ACCOUNT_DISABLED' };

  if (product && !canAccessProduct(user.kyc_level, product)) {
    const required = KYC_PRODUCTS[product];
    return {
      allowed: false,
      reason: `${product} requires ${required} KYC verification`,
      code: 'KYC_TIER_REQUIRED',
      requiredLevel: required,
      currentLevel: user.kyc_level,
    };
  }

  const limits = resolveLimits(user, countryCode);
  const amountUgx = fiatToUgx(parseFloat(fiatAmount), fiatCurrency);

  if (amountUgx > limits.perTxUgx) {
    return {
      allowed: false,
      reason: `Exceeds per-transaction limit of ${limits.perTxUgx.toLocaleString()} UGX (${limits.tierLabel}, ${limits.kycLevel})`,
      code: 'KYC_PER_TX_LIMIT',
      limits,
      amountUgx,
    };
  }

  const dailyUsedUgx = await getDailyVolumeUgx(userId);
  if (dailyUsedUgx + amountUgx > limits.dailyUgx) {
    return {
      allowed: false,
      reason: `Exceeds daily limit of ${limits.dailyUgx.toLocaleString()} UGX (used today: ${Math.round(dailyUsedUgx).toLocaleString()} UGX, ${limits.tierLabel})`,
      code: 'KYC_DAILY_LIMIT',
      limits,
      dailyUsedUgx,
      amountUgx,
    };
  }

  return { allowed: true, limits, dailyUsedUgx, amountUgx };
}

export async function getUserTierSummary(userId, countryCode) {
  const userResult = await db.query(
    `SELECT kyc_level, daily_limit_ugx FROM users WHERE id = $1`,
    [userId]
  );
  if (!userResult.rows[0]) return null;

  const user = userResult.rows[0];
  const limits = resolveLimits(user, countryCode);
  const dailyUsedUgx = await getDailyVolumeUgx(userId);

  return {
    kyc_level: user.kyc_level,
    tier: limits.tierLabel,
    country_code: limits.countryCode,
    limits: {
      per_tx_ugx: limits.perTxUgx,
      daily_ugx: limits.dailyUgx,
      daily_used_ugx: Math.round(dailyUsedUgx),
      daily_remaining_ugx: Math.max(0, limits.dailyUgx - Math.round(dailyUsedUgx)),
    },
    products: limits.products,
    tiers: config.kycLimits,
  };
}

export default {
  KYC_PRODUCTS,
  networkToCountryCode,
  canAccessProduct,
  resolveLimits,
  checkTransactionLimits,
  getUserTierSummary,
};
