import { Router } from 'express';
import { authUser } from '../middleware/auth.js';
import { enforceKycTransactionLimits, requireKycProduct } from '../middleware/kycLimits.js';
import { validate, validateTypes } from '../middleware/validate.js';
import utilityService from '../services/utilities/utilityService.js';
import reloadlyClient from '../services/utilities/reloadlyClient.js';
import config from '../config/index.js';

const router = Router();

/**
 * GET /api/v1/utilities/providers?country=UG&type=airtime
 */
router.get('/providers', authUser, async (req, res, next) => {
  try {
    const country = String(req.query.country || 'UG').trim().toUpperCase();
    const type = String(req.query.type || 'airtime').toLowerCase();
    const data = await utilityService.listProviders(country, type);
    res.json({ status: 'ok', data, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/utilities/operators?country=UG
 * Reloadly operator list (cached client-side recommended).
 */
router.get('/operators', authUser, async (req, res, next) => {
  try {
    const country = String(req.query.country || 'UG').trim().toUpperCase();
    const data = await utilityService.listOperators(country);
    res.json({
      status: 'ok',
      data,
      reloadlyMock: reloadlyClient.reloadlyIsMock(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/utilities/quote
 * Body: { country, networkCode, recipientPhone, fiatAmount, type?, operatorId? }
 */
router.post(
  '/quote',
  authUser,
  requireKycProduct('airtime'),
  validate(['country', 'networkCode', 'recipientPhone', 'fiatAmount']),
  validateTypes({
    fiatAmount: 'positiveNumber',
    networkCode: 'mobileNetwork',
    recipientPhone: 'string',
  }),
  enforceKycTransactionLimits('airtime'),
  async (req, res, next) => {
    try {
      const quote = await utilityService.createQuote({
        userId: req.userId,
        countryCode: req.body.country,
        networkCode: req.body.networkCode,
        recipientPhone: req.body.recipientPhone,
        fiatAmount: req.body.fiatAmount,
        utilityType: req.body.type || 'airtime',
        operatorId: req.body.operatorId,
      });

      res.json({ status: 'ok', data: quote, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/utilities/purchase
 * Body: { quoteId, paymentTxHash? }
 * paymentTxHash required unless UTILITY_ALLOW_MOCK_PURCHASE=true (staging).
 */
router.post(
  '/purchase',
  authUser,
  requireKycProduct('airtime'),
  validate(['quoteId']),
  validateTypes({ quoteId: 'uuid' }),
  async (req, res, next) => {
    try {
      const result = await utilityService.completePurchase({
        userId: req.userId,
        quoteId: req.body.quoteId,
        paymentTxHash: req.body.paymentTxHash,
      });

      res.json({ status: 'ok', data: result, timestamp: new Date().toISOString() });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
      next(err);
    }
  }
);

/**
 * GET /api/v1/utilities/history
 */
router.get('/history', authUser, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const data = await utilityService.getPurchaseHistory(req.userId, limit);
    res.json({ status: 'ok', data, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/utilities/config
 * Public utility settings for clients.
 */
router.get('/config', (req, res) => {
  res.json({
    status: 'ok',
    data: {
      feePercent: config.utilities.feePercent,
      quoteTtlSeconds: config.utilities.quoteTtlSeconds,
      minFiatAmount: config.utilities.minFiatAmount,
      maxFiatAmount: config.utilities.maxFiatAmount,
      reloadlyMock: reloadlyClient.reloadlyIsMock(),
      mockPurchaseAllowed: config.utilities.allowMockPurchase,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
