import { Router } from 'express';
import multer from 'multer';
import { authUser } from '../middleware/auth.js';
import { enforceKycTransactionLimits } from '../middleware/kycLimits.js';
import { validate, validateTypes } from '../middleware/validate.js';
import { cashoutStatusLimiter } from '../middleware/rateLimits.js';
import buyQuoteEngine from '../services/buyQuoteEngine.js';
import buyOrchestrator from '../services/buyOrchestrator.js';
import buyMatchingEngine from '../services/buyMatchingEngine.js';
import payoutSettingsService from '../services/payoutSettingsService.js';
import quoteEngine from '../services/quoteEngine.js';
import config from '../config/index.js';
import db from '../db/index.js';
import { getVerifiedTraderMomo } from '../services/traderMomoService.js';
import logger from '../utils/logger.js';
import USER_ACTIVE_ORDER_STATES from '../constants/userActiveOrderStates.js';
import storageService from '../services/storageService.js';
import paymentRouter from '../services/payments/paymentRouter.js';
import { PAYMENT_SIDES } from '../services/payments/paymentConstants.js';
import countryService from '../services/countries/countryService.js';
import { formatShortId } from '../utils/shortId.js';

const router = Router();

const paymentProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPEG and PNG images are allowed'), ok);
  },
});

/**
 * POST /api/v1/buy/quote
 * Buy quote — with payoutSettingId = manual P2P; without = Express auto-match.
 */
router.post(
  '/quote',
  authUser,
  validate(['network', 'phoneHash', 'fiatAmount']),
  validateTypes({ fiatAmount: 'positiveNumber', network: 'mobileNetwork', phoneHash: 'phoneHash' }),
  enforceKycTransactionLimits('onramp'),
  async (req, res, next) => {
    try {
      const { fiatAmount, network, phoneHash, payoutSettingId } = req.body;
      const fiatNum = typeof fiatAmount === 'string' ? parseFloat(fiatAmount) : fiatAmount;

      const activeOrder = await db.query(
        `SELECT id FROM transactions WHERE user_id = $1 AND state::text = ANY($2::text[]) LIMIT 1`,
        [req.userId, USER_ACTIVE_ORDER_STATES]
      );
      if (activeOrder.rows[0]) {
        return res.status(409).json({
          error: 'active_order_exists',
          transaction_id: activeOrder.rows[0].id,
        });
      }

      const fiatCurrency = quoteEngine.networkToFiat(network);

      const countryCode = paymentRouter.networkToCountryCode(network);
      if (!countryCode || !countryService.isActiveCountry(countryCode)) {
        return res.status(400).json({
          error: 'Buy is only available in Uganda for now. Other countries are coming soon.',
          code: 'COUNTRY_NOT_AVAILABLE',
          supportedCountries: countryService.getActiveCountries().map((c) => c.code),
        });
      }
      if (!countryService.isValidNetworkForCountry(countryCode, network)) {
        return res.status(400).json({
          error: `Network ${network} is not available for ${countryCode}.`,
          code: 'NETWORK_NOT_AVAILABLE',
        });
      }
      const paymentPlan = paymentRouter.resolvePaymentPlan({
        countryCode,
        side: PAYMENT_SIDES.ONRAMP,
      });

      const networkLimits = await payoutSettingsService.getActiveBuyNetworkLimits(network, fiatCurrency);
      const yellowAvailable = paymentPlan?.hasAutomatedRail;
      if (!networkLimits.hasTraders && !yellowAvailable) {
        return res.status(503).json({
          error: 'No traders selling USDC on this network right now.',
          code: 'NO_BUY_TRADERS',
          paymentPlan: paymentPlan ? {
            countryCode: paymentPlan.countryCode,
            unavailable: paymentPlan.unavailable,
          } : null,
        });
      }
      if (networkLimits.maxFiat != null && fiatNum > networkLimits.maxFiat) {
        return res.status(400).json({ error: 'Amount too large', code: 'AMOUNT_ABOVE_NETWORK_MAX' });
      }
      if (networkLimits.minFiat != null && fiatNum < networkLimits.minFiat) {
        return res.status(400).json({ error: 'Amount too small', code: 'AMOUNT_BELOW_NETWORK_MIN' });
      }

      const quote = await buyQuoteEngine.createBuyQuoteFromFiat({
        userId: req.userId,
        fiatAmount: fiatNum,
        network,
        phoneHash,
        payoutSettingId: payoutSettingId || null,
      });

      res.json({
        quoteId: quote.id,
        memo: quote.memo,
        escrowAddress: quote.escrow_address,
        usdcAmount: Number(quote.path_usdc_received),
        userRate: Number(quote.user_rate),
        fiatAmount: Number(quote.fiat_amount),
        fiatCurrency: quote.fiat_currency,
        platformFee: Number(quote.platform_fee),
        expiresAt: quote.expires_at,
        payoutSettingId: quote.preferred_payout_setting_id,
        traderName: quote.expressTraderName || null,
        orderSide: 'BUY',
        express: !payoutSettingId,
        paymentPlan: paymentPlan ? {
          countryCode: paymentPlan.countryCode,
          primary: paymentPlan.primary,
          fallbackChain: paymentPlan.fallbackChain,
          hasAutomatedRail: paymentPlan.hasAutomatedRail,
          hasP2pFallback: paymentPlan.hasP2pFallback,
        } : null,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      next(err);
    }
  }
);

/**
 * POST /api/v1/buy/confirm
 * Confirm buy order — creates transaction and matches trader.
 */
router.post(
  '/confirm',
  authUser,
  validate(['quoteId']),
  async (req, res, next) => {
    try {
      const { quoteId } = req.body;
      const transaction = await buyOrchestrator.confirmBuyOrder({ quoteId, userId: req.userId });
      res.json({
        status: 'CONFIRMED',
        transactionId: transaction.id,
        state: transaction.state,
        orderSide: 'BUY',
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      next(err);
    }
  }
);

/**
 * POST /api/v1/buy/payment-sent
 * User confirms MoMo payment sent (after trader locked USDC).
 */
router.post(
  '/payment-sent',
  authUser,
  paymentProofUpload.single('proof'),
  validate(['transactionId', 'paymentReference']),
  async (req, res, next) => {
    try {
      const { transactionId, paymentReference } = req.body;
      let proofStorageKey = null;
      let proofSignedUrl = null;

      if (req.file) {
        proofStorageKey = await storageService.saveChatImage(
          req.file.buffer,
          req.file.originalname,
          transactionId
        );
        const signed = await storageService.getSignedUrl(proofStorageKey, 60 * 60 * 24 * 30);
        proofSignedUrl = signed?.url || null;
      }

      const transaction = await buyMatchingEngine.submitUserPaymentSent(
        transactionId,
        req.userId,
        paymentReference,
        { proofStorageKey, proofSignedUrl }
      );

      res.json({ success: true, transactionId: transaction.id, state: transaction.state });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      next(err);
    }
  }
);

/**
 * GET /api/v1/buy/status/:id
 */
router.get('/status/:id', authUser, cashoutStatusLimiter, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.*, tr.name AS trader_name
       FROM transactions t
       LEFT JOIN traders tr ON tr.id = t.trader_id
       WHERE (t.id = $1 OR t.quote_id = $1) AND t.user_id = $2 AND t.order_side = 'BUY'`,
      [req.params.id, req.userId]
    );
    const tx = result.rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const traderMomo = tx.trader_id
      ? await getVerifiedTraderMomo(tx.trader_id, tx.network)
      : null;

    res.json({
      id: tx.id,
      state: tx.state,
      short_id: formatShortId(tx.id),
      order_side: 'BUY',
      usdc_amount: tx.usdc_amount != null ? parseFloat(tx.usdc_amount) : null,
      fiat_amount: tx.fiat_amount != null ? parseFloat(tx.fiat_amount) : null,
      fiat_currency: tx.fiat_currency,
      network: tx.network,
      trader_id: tx.trader_id,
      trader_name: tx.trader_name,
      trader_receive_phone: traderMomo?.phone_number || null,
      trader_receive_name: traderMomo?.account_name || null,
      payment_expires_at: tx.payment_expires_at,
      stellar_deposit_tx: tx.stellar_deposit_tx,
      stellar_release_tx: tx.stellar_release_tx,
      preferred_payout_setting_id: tx.preferred_payout_setting_id,
      selection_method: 'manual',
      payout_reference: tx.payout_reference,
      created_at: tx.created_at,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
