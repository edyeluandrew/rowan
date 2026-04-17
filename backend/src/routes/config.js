import { Router } from 'express';
import config from '../config/index.js';
import { USDC_ASSET } from '../config/stellar.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/config
 *
 * Public endpoint that returns non-sensitive client configuration.
 * Used by frontends to bootstrap themselves with network and asset info.
 *
 * Response:
 *  - stellar: Network parameters (network name, horizon URL, asset info)
 *  - api_url: Public URL of this API server
 *  - node_env: Current environment (for debugging)
 *
 * Note: This endpoint intentionally omits secrets like private keys,
 * encryption keys, DB credentials, etc.
 */
router.get('/', (req, res) => {
  try {
    res.json({
      stellar: {
        network: config.stellar.network,
        horizonUrl: config.stellar.horizonUrl,
        networkPassphrase:
          config.stellar.network === 'mainnet'
            ? 'Public Global Stellar Network ; September 2015'
            : 'Test SDF Network ; September 2015',
        usdc: {
          code: USDC_ASSET.code,
          issuer: USDC_ASSET.issuer,
        },
        sep10SigningKey: process.env.SEP10_SIGNING_KEY,
      },
      api_url: process.env.API_URL,
      node_env: config.nodeEnv,
    });
  } catch (err) {
    logger.error('[Config] Error serving config endpoint:', err.message);
    res.status(500).json({ error: 'Failed to retrieve config', details: err.message });
  }
});

/**
 * GET /api/v1/config/cashout-limits
 * 
 * [PHASE 3] Expose cashout-critical configuration values for frontend synchronization.
 * 
 * Frontend can call this endpoint to:
 * - Get the actual min XLM amounts from backend config
 * - Learn about quote TTL and other timing windows
 * - Get KYC tier limits for display purposes
 * - Stay in sync without hardcoding values
 * 
 * Response includes both user-facing values and internal operational config.
 * 
 * [PHASE 4] Now includes KYC limits and fraud thresholds for admin/transparency.
 */
router.get('/cashout-limits', async (req, res, next) => {
  try {
    const limits = {
      // User-facing limits
      minXlmAmount: config.platform.minXlmAmount,
      // Quote timing
      quoteTtlSeconds: config.platform.quoteTtlSeconds,
      // Internal timing (for reference; frontend typically doesn't need this)
      timeoutsSec: {
        traderAccept: config.platform.traderAcceptTimeoutSeconds,
        traderConfirm: config.platform.traderConfirmTimeoutSeconds,
        stellarTx: 30, // Hardcoded in Stellar SDK
      },
      // Slippage protection
      slippagePercent: config.platform.quoteSlippagePercent,
      // [PHASE 4] KYC-tiered limits (for transparency and admin display)
      kycLimits: config.kycLimits,
      // [PHASE 4] Amount mismatch tolerance for deposit verification
      xlmAmountMismatchTolerance: config.platform.xlmAmountMismatchTolerance,
    };

    logger.debug('[Config] Serving cashout-limits endpoint', { limits });

    res.json({
      status: 'ok',
      data: limits,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[Config] Error serving cashout-limits:', err.message);
    next(err);
  }
});

export default router;
