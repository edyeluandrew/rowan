import { Router } from 'express';
import { authUser } from '../middleware/auth.js';
import { enforceKycTransactionLimits, requireKycProduct } from '../middleware/kycLimits.js';
import { validate, validateTypes } from '../middleware/validate.js';
import utilityService from '../services/utilities/utilityService.js';
import reloadlyClient from '../services/utilities/reloadlyClient.js';
import reloadlyUtilityPaymentsClient from '../services/utilities/reloadlyUtilityPaymentsClient.js';
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
 * GET /api/v1/utilities/bundles?country=UG&networkCode=MTN_UG&recipientPhone=256...
 * Reloadly fixed data bundles for a phone number.
 */
router.get('/bundles', authUser, async (req, res, next) => {
  try {
    const country = String(req.query.country || 'UG').trim().toUpperCase();
    const networkCode = String(req.query.networkCode || '').trim().toUpperCase();
    const recipientPhone = String(req.query.recipientPhone || '').trim();
    if (!networkCode || !recipientPhone) {
      return res.status(400).json({ error: 'networkCode and recipientPhone are required' });
    }
    const data = await utilityService.listDataBundles({
      countryCode: country,
      networkCode,
      recipientPhone,
    });
    res.json({ status: 'ok', data, timestamp: new Date().toISOString() });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/**
 * GET /api/v1/utilities/bill-lookup?billerId=&subscriberAccount=&fiatAmount=
 * Pre-payment account check — only returns name/units in Reloadly sandbox mock.
 * Live Reloadly confirms name + kWh on GET /transactions/{id} after payment.
 */
router.get('/bill-lookup', authUser, async (req, res, next) => {
  try {
    const billerId = req.query.billerId;
    const subscriberAccount = String(req.query.subscriberAccount || '').trim();
    const fiatAmount = Number(req.query.fiatAmount);
    if (!billerId || !subscriberAccount) {
      return res.status(400).json({ error: 'billerId and subscriberAccount are required' });
    }
    const data = await utilityService.lookupBillAccount({
      billerId,
      subscriberAccount,
      fiatAmount: Number.isFinite(fiatAmount) ? fiatAmount : 0,
      billerServiceType: req.query.serviceType,
    });
    res.json({ status: 'ok', data, timestamp: new Date().toISOString() });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/**
 * GET /api/v1/utilities/billers?country=UG
 */
router.get('/billers', authUser, async (req, res, next) => {
  try {
    const country = String(req.query.country || 'UG').trim().toUpperCase();
    const data = await utilityService.listBillers(country);
    res.json({ status: 'ok', data, timestamp: new Date().toISOString() });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/**
 * POST /api/v1/utilities/quote
 * Body (airtime/data): { country, networkCode, recipientPhone, fiatAmount, type?, operatorId?, bundleDescription? }
 * Body (bill): { country, billerId, subscriberAccount, fiatAmount, type:'bill', billerName?, bundleDescription? }
 */
router.post(
  '/quote',
  authUser,
  requireKycProduct('airtime'),
  enforceKycTransactionLimits('airtime'),
  async (req, res, next) => {
    try {
      const type = String(req.body.type || 'airtime').toLowerCase();

      if (type === 'bill') {
        const missing = ['country', 'billerId', 'subscriberAccount', 'fiatAmount']
          .filter((f) => req.body[f] == null || req.body[f] === '');
        if (missing.length) {
          return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
        }
        const fiat = Number(req.body.fiatAmount);
        if (!Number.isFinite(fiat) || fiat <= 0) {
          return res.status(400).json({ error: 'fiatAmount must be a positive number' });
        }
      } else {
        const missing = ['country', 'networkCode', 'recipientPhone', 'fiatAmount']
          .filter((f) => req.body[f] == null || req.body[f] === '');
        if (missing.length) {
          return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
        }
        const fiat = Number(req.body.fiatAmount);
        if (!Number.isFinite(fiat) || fiat <= 0) {
          return res.status(400).json({ error: 'fiatAmount must be a positive number' });
        }
      }

      const quote = await utilityService.createQuote({
        userId: req.userId,
        countryCode: req.body.country,
        networkCode: req.body.networkCode,
        recipientPhone: req.body.recipientPhone,
        fiatAmount: req.body.fiatAmount,
        utilityType: type,
        operatorId: req.body.operatorId || req.body.billerId,
        bundleDescription: req.body.bundleDescription,
        billerName: req.body.billerName,
        subscriberAccount: req.body.subscriberAccount,
        billerServiceType: req.body.billerServiceType || req.body.serviceType,
        billerType: req.body.billerType,
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
 * GET /api/v1/utilities/purchase/:id/delivery
 * Poll Reloadly for prepaid electricity units + Yaka token (bill payments only).
 */
router.get('/purchase/:id/delivery', authUser, async (req, res, next) => {
  try {
    const data = await utilityService.refreshBillDelivery({
      userId: req.userId,
      purchaseId: req.params.id,
    });
    res.json({ status: 'ok', data, timestamp: new Date().toISOString() });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

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
      reloadlyUtilitiesMock: reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock(),
      mockPurchaseAllowed: config.utilities.allowMockPurchase,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
