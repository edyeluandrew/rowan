/**
 * Phase 2 A4 — KYC tier middleware for cashout, buy, utilities.
 */

import db from '../db/index.js';
import quoteEngine from '../services/quoteEngine.js';
import kycTierService from '../services/kyc/kycTierService.js';
import fraudMonitor from '../services/fraudMonitor.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

async function loadUser(userId) {
  const result = await db.query(
    `SELECT id, kyc_level, daily_limit_ugx, is_active, per_tx_limit FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Require minimum KYC tier for a product (airtime, savings, etc.).
 */
export function requireKycProduct(product) {
  return async (req, res, next) => {
    try {
      const user = await loadUser(req.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });

      if (!kycTierService.canAccessProduct(user.kyc_level, product)) {
        const required = kycTierService.KYC_PRODUCTS[product];
        return res.status(403).json({
          error: `This feature requires ${required} identity verification`,
          code: 'KYC_TIER_REQUIRED',
          product,
          requiredLevel: required,
          currentLevel: user.kyc_level,
        });
      }

      req.kycUser = user;
      next();
    } catch (err) {
      logger.error('[KycLimits] requireKycProduct error:', err.message);
      return res.status(500).json({ error: 'KYC check failed' });
    }
  };
}

/**
 * Enforce tier limits + fraud rules on quote/trade requests.
 */
export function enforceKycTransactionLimits(product) {
  return async (req, res, next) => {
    try {
      const user = await loadUser(req.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });

      const network = req.body?.network;
      const countryCode = network ? kycTierService.networkToCountryCode(network) : null;
      const fiatCurrency = network ? quoteEngine.networkToFiat(network) : 'UGX';

      let fiatEstimate = null;
      const hasFiat = req.body.fiatAmount != null && req.body.fiatAmount !== '';
      const hasXlm = req.body.xlmAmount != null && req.body.xlmAmount !== '';
      const hasUsdc = req.body.usdcAmount != null && req.body.usdcAmount !== '';

      if (hasFiat) {
        fiatEstimate = parseFloat(req.body.fiatAmount);
      } else if (hasXlm) {
        const rate = await quoteEngine.getLegacyXlmRate(fiatCurrency);
        fiatEstimate = parseFloat(req.body.xlmAmount) * rate;
      } else if (hasUsdc) {
        const usdc = parseFloat(req.body.usdcAmount);
        let fiatRate;
        try {
          fiatRate = await quoteEngine.getUsdcToFiatRate(fiatCurrency);
        } catch {
          fiatRate = config.usdcFiatRates[fiatCurrency] || config.usdcFiatRates.UGX;
        }
        fiatEstimate = usdc * fiatRate;
      }

      if (fiatEstimate != null && Number.isFinite(fiatEstimate) && fiatEstimate > 0) {
        const fraudCheck = await fraudMonitor.checkTransaction(
          req.userId,
          fiatEstimate,
          fiatCurrency,
          { countryCode, product }
        );

        if (!fraudCheck.allowed) {
          return res.status(403).json({
            error: fraudCheck.reason,
            code: fraudCheck.code || 'FRAUD_BLOCK',
            limits: fraudCheck.limits,
            requiredLevel: fraudCheck.requiredLevel,
            currentLevel: fraudCheck.currentLevel,
          });
        }

        req.kycLimits = fraudCheck.limits;
      } else if (product && !kycTierService.canAccessProduct(user.kyc_level, product)) {
        const required = kycTierService.KYC_PRODUCTS[product];
        return res.status(403).json({
          error: `This feature requires ${required} identity verification`,
          code: 'KYC_TIER_REQUIRED',
          product,
          requiredLevel: required,
          currentLevel: user.kyc_level,
        });
      }

      req.user = user;
      next();
    } catch (err) {
      logger.error('[KycLimits] enforceKycTransactionLimits error:', err.message);
      return res.status(500).json({ error: 'Limit check failed' });
    }
  };
}

export default { requireKycProduct, enforceKycTransactionLimits };
