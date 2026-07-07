import { Router } from 'express';
import { authUser, checkUserLimits } from '../middleware/auth.js';
import { validate, validateTypes } from '../middleware/validate.js';
import { cashoutStatusLimiter } from '../middleware/rateLimits.js';
import quoteEngine from '../services/quoteEngine.js';
import fraudMonitor from '../services/fraudMonitor.js';
import notificationService from '../services/notificationService.js';
import payoutSettingsService from '../services/payoutSettingsService.js';
import config from '../config/index.js';
import db from '../db/index.js';
import { getVerifiedTraderMomo } from '../services/traderMomoService.js';
import redis from '../db/redis.js';
import logger from '../utils/logger.js';
import USER_ACTIVE_ORDER_STATES from '../constants/userActiveOrderStates.js';
import storageService from '../services/storageService.js';
import { formatShortId } from '../utils/shortId.js';

/** Wait briefly for Horizon watcher + escrow to create the transaction row. */
async function resolveTransactionIdForQuote(quoteId, maxWaitMs = 20000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const cached = await redis.get(`quote:${quoteId}:tx`);
      if (cached) return cached;
    } catch {
      /* redis optional during lookup */
    }

    const txResult = await db.query(
      `SELECT id FROM transactions WHERE quote_id = $1 LIMIT 1`,
      [quoteId]
    );
    if (txResult.rows[0]?.id) return txResult.rows[0].id;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

const router = Router();

/**
 * POST /api/v1/cashout/quote
 * Request a locked exchange rate.
 * Body: { xlmAmount | fiatAmount, network, phoneHash, payoutPhone?, payoutName? }
 */
router.post(
  '/quote',
  authUser,
  validate(['network', 'phoneHash']),
  validateTypes({ xlmAmount: 'positiveNumber', fiatAmount: 'positiveNumber', network: 'mobileNetwork', phoneHash: 'phoneHash' }),
  checkUserLimits,
  async (req, res, next) => {
    try {
      const { xlmAmount, fiatAmount, network, phoneHash, payoutPhone, payoutName, payoutSettingId } = req.body;

      logger.info(`[Cashout] getQuote called: xlmAmount=${xlmAmount}, fiatAmount=${fiatAmount}, network=${network}, phoneHash=${phoneHash?.slice(0, 8)}..., payoutSettingId=${payoutSettingId || 'auto'}`);

      const activeOrder = await db.query(
        `SELECT id, state FROM transactions
         WHERE user_id = $1 AND state::text = ANY($2::text[])
         LIMIT 1`,
        [req.userId, USER_ACTIVE_ORDER_STATES]
      );
      if (activeOrder.rows[0]) {
        return res.status(409).json({
          error: 'active_order_exists',
          message: 'You already have an active order in progress. Please complete or cancel it before starting a new one.',
          transaction_id: activeOrder.rows[0].id,
        });
      }

      const hasXlm = xlmAmount != null && xlmAmount !== '';
      const hasFiat = fiatAmount != null && fiatAmount !== '';
      if (hasXlm === hasFiat) {
        return res.status(400).json({
          error: 'Provide exactly one of xlmAmount or fiatAmount (net mobile-money amount you want to receive).',
          code: 'AMOUNT_MODE_REQUIRED',
        });
      }

      const fiatCurrency = quoteEngine.networkToFiat(network);
      let xlmNum = null;
      let fiatNum = null;
      let fiatEstimate = null;

      if (hasXlm) {
        xlmNum = typeof xlmAmount === 'string' ? parseFloat(xlmAmount) : xlmAmount;
        if (!Number.isFinite(xlmNum) || xlmNum <= 0) {
          return res.status(400).json({
            error: `XLM amount must be a positive number (got: ${xlmAmount})`,
          });
        }
        if (xlmNum < config.platform.minXlmAmount) {
          return res.status(400).json({
            error: `Minimum cash-out amount is ${config.platform.minXlmAmount} XLM`,
          });
        }
        try {
          const currentRate = await quoteEngine.getLegacyXlmRate(fiatCurrency);
          fiatEstimate = xlmNum * currentRate;
        } catch (err) {
          logger.warn(`[Cashout] Legacy rate fetch for fraud check failed:`, err.message);
          return res.status(503).json({ error: 'Unable to fetch rates. Please try again.' });
        }
        logger.info(`[Cashout] getQuote (XLM): xlmAmount=${xlmNum}, network=${network}`);
      } else {
        fiatNum = typeof fiatAmount === 'string' ? parseFloat(fiatAmount) : fiatAmount;
        if (!Number.isFinite(fiatNum) || fiatNum <= 0) {
          return res.status(400).json({
            error: `Fiat amount must be a positive number (got: ${fiatAmount})`,
          });
        }
        fiatEstimate = fiatNum;
        logger.info(`[Cashout] getQuote (fiat): fiatAmount=${fiatNum}, network=${network}`);
      }
      const fraudCheck = await fraudMonitor.checkTransaction(req.userId, fiatEstimate, fiatCurrency);
      if (!fraudCheck.allowed) {
        logger.warn(`[Cashout] Fraud check failed: ${fraudCheck.reason}`);
        return res.status(403).json({ error: fraudCheck.reason });
      }

      const networkLimits = await payoutSettingsService.getActiveNetworkLimits(network, fiatCurrency);
      if (!networkLimits.hasTraders) {
        return res.status(503).json({
          error: 'No verified traders are available for this network right now. Try another network or try again later.',
          code: 'NO_TRADERS_FOR_NETWORK',
        });
      }
      if (networkLimits.maxFiat != null && fiatEstimate > networkLimits.maxFiat) {
        return res.status(400).json({
          error: hasFiat
            ? `Amount too large. Maximum payout for this network is ${Math.floor(networkLimits.maxFiat).toLocaleString()} ${fiatCurrency}.`
            : `Amount too large. Maximum payout for this network is ${Math.floor(networkLimits.maxFiat).toLocaleString()} ${fiatCurrency}. Send less XLM and try again.`,
          code: 'AMOUNT_ABOVE_NETWORK_MAX',
          maxFiat: networkLimits.maxFiat,
          minFiat: networkLimits.minFiat,
          currency: fiatCurrency,
        });
      }
      if (networkLimits.minFiat != null && fiatEstimate < networkLimits.minFiat) {
        return res.status(400).json({
          error: hasFiat
            ? `Amount too small. Minimum payout for this network is ${Math.ceil(networkLimits.minFiat).toLocaleString()} ${fiatCurrency}.`
            : `Amount too small. Minimum payout for this network is ${Math.ceil(networkLimits.minFiat).toLocaleString()} ${fiatCurrency}. Send more XLM and try again.`,
          code: 'AMOUNT_BELOW_NETWORK_MIN',
          maxFiat: networkLimits.maxFiat,
          minFiat: networkLimits.minFiat,
          currency: fiatCurrency,
        });
      }

      logger.info(`[Cashout] ✅ Fraud check passed. Creating quote (mode=${hasFiat ? 'fiat' : 'xlm'})`);
      
      let quote;
      try {
        const quoteParams = {
          userId: req.userId,
          network,
          phoneHash,
          payoutPhone: payoutPhone?.trim(),
          payoutName: payoutName?.trim(),
          payoutSettingId: payoutSettingId || null,
        };
        quote = hasFiat
          ? await quoteEngine.createQuoteFromFiat({ ...quoteParams, targetNetFiat: fiatNum })
          : await quoteEngine.createQuote({ ...quoteParams, xlmAmount: xlmNum });
      } catch (quoteErr) {
        logger.error(`[Cashout] Quote creation failed:`, quoteErr.message);
        // [PHASE 2C] Honor structured unavailability errors (e.g. unsafe fallback
        // blocked) with a clean client message — do NOT create an unsettleable cashout.
        if (quoteErr.code === 'QUOTE_UNAVAILABLE' || quoteErr.code === 'QUOTE_UNAVAILABLE_FALLBACK_CAP'
            || quoteErr.code === 'FIAT_FX_UNAVAILABLE' || quoteErr.code === 'FIAT_FX_STATIC_BLOCKED'
            || quoteErr.code === 'FIAT_FX_STALE') {
          return res.status(quoteErr.statusCode || 503).json({
            error: quoteErr.message,
            code: quoteErr.code,
          });
        }
        // Return 503 for transient errors (no liquidity) or 400 for permanent errors
        if (quoteErr.message.includes('No valid path') || quoteErr.message.includes('No liquidity')) {
          return res.status(503).json({ 
            error: 'Liquidity unavailable right now. Please try again later.' 
          });
        }
        if (quoteErr.statusCode && quoteErr.statusCode < 500) {
          return res.status(quoteErr.statusCode).json({
            error: quoteErr.message,
            code: quoteErr.code || undefined,
          });
        }
        return res.status(503).json({ 
          error: quoteErr.message || 'Unable to generate quote. Please try again.',
        });
      }

      // [SMS Integration] Cache the phone number for SMS fallback notifications
      // Phone number comes from the request body — store in Redis for later retrieval
      // This enables SMS fallback if user goes offline during transaction
      if (req.body.phoneNumber) {
        await notificationService.cacheUserPhoneNumber(req.userId, req.body.phoneNumber);
        logger.debug(`[Cashout] Cached phone number for user ${req.userId}`);
      }

      res.json({
        quoteId: quote.id,
        memo: quote.memo,
        escrowAddress: quote.escrow_address,
        xlmAmount: quote.xlm_amount,
        usdcAmount: quote.usdc_deposit_amount != null ? Number(quote.usdc_deposit_amount) : null,
        depositAsset: quote.deposit_asset || 'USDC',
        userRate: quote.user_rate,
        fiatAmount: quote.fiat_amount,
        fiatCurrency: quote.fiat_currency,
        platformFee: quote.platform_fee,
        expiresAt: quote.expires_at,
        requestedFiatAmount: hasFiat ? fiatNum : null,
        network,
        // [PHASE 2C] Rate transparency: LIVE = priced from real liquidity,
        // FALLBACK = indicative rate (path discovery was unavailable).
        rateSource: quote.rate_source || (quote.quote_source === 'horizon-path' ? 'LIVE' : 'FALLBACK'),
        pathAvailable: quote.quote_source === 'horizon-path',
        quoteWarning: quote.quote_warning || null,
        fxSource: quote.fx_source || null,
        fxRate: quote.fx_rate != null ? Number(quote.fx_rate) : null,
        fxCurrency: quote.fx_currency || quote.fiat_currency || null,
        fxProvider: quote.fx_provider || null,
        fxAgeSeconds: quote.fx_age_seconds != null ? Number(quote.fx_age_seconds) : null,
        fxFetchedAt: quote.fx_fetched_at || null,
        fxWarning: quote.fx_warning || null,
        fiatRateSource: quote.fiat_rate_source || null,
        payoutSettingId: quote.preferred_payout_setting_id || null,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/cashout/confirm
 * User confirms they've signed and broadcast the Stellar transaction.
 * Body: { quoteId, stellarTxHash }
 * (The Horizon watcher handles actual deposit verification —
 *  this endpoint is an optional explicit confirmation from the wallet.)
 */
router.post(
  '/confirm',
  authUser,
  validate(['quoteId', 'stellarTxHash']),
  async (req, res, next) => {
    try {
      const { quoteId, stellarTxHash } = req.body;
      
      logger.info(`[Cashout] confirmQuote called: quoteId=${quoteId}, userId=${req.userId}, txHash=${stellarTxHash}`);

      // Try to find by quote ID first
      let quoteResult = await db.query(
        `SELECT id, is_used, expires_at FROM quotes WHERE id = $1 AND user_id = $2`,
        [quoteId, req.userId]
      );
      
      let quote = quoteResult.rows[0];
      
      if (!quote) {
        logger.warn(`[Cashout] Quote not found by ID: quoteId=${quoteId}, userId=${req.userId}`);
        // Check if the quote exists at all (maybe wrong user?)
        const allQuotes = await db.query(`SELECT id, user_id FROM quotes WHERE id = $1`, [quoteId]);
        if (allQuotes.rows.length > 0) {
          logger.warn(`[Cashout] Quote EXISTS but wrong user! Quote belongs to userId: ${allQuotes.rows[0].user_id}`);
        } else {
          logger.warn(`[Cashout] Quote DOES NOT EXIST in database`);
        }
        return res.status(404).json({ error: 'Quote not found' });
      }
      
      logger.info(`[Cashout] Quote found: id=${quote.id}, is_used=${quote.is_used}, expires_at=${quote.expires_at}`);
      
      if (new Date(quote.expires_at) < new Date()) {
        logger.warn(`[Cashout] Quote expired: ${quote.id}, expired at ${quote.expires_at}`);
        return res.status(410).json({ error: 'Quote expired' });
      }

      let transactionId = await resolveTransactionIdForQuote(quote.id);

      if (transactionId) {
        logger.info(`[Cashout] ✅ confirmQuote for quote ${quote.id}, tx: ${transactionId}`);
      } else {
        logger.info(`[Cashout] confirmQuote: escrow still processing quote ${quote.id} after wait`);
      }

      res.json({
        status: transactionId ? 'CONFIRMED' : 'PENDING_DEPOSIT',
        message: transactionId
          ? 'Transaction confirmed. Tracking escrow and trader match.'
          : 'Transaction broadcast received. Waiting for on-chain confirmation.',
        quoteId: quote.id,
        transactionId,
        stellarTxHash,
      });
    } catch (err) {
      logger.error(`[Cashout] confirmQuote error:`, err.message);
      next(err);
    }
  }
);

/**
 * GET /api/v1/cashout/status/:id
 * Poll transaction state for the authenticated wallet user only.
 * [PHASE 2H-2] Requires JWT; returns a sanitized status DTO (no sensitive settlement fields).
 */
router.get('/status/:id', authUser, cashoutStatusLimiter, async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = req.userId;

    logger.info(`[Cashout] status query for id: ${id}, userId: ${userId}`);

    let result = await db.query(
      `SELECT t.id, t.state, t.xlm_amount, t.usdc_amount, t.fiat_amount, t.fiat_currency, t.network,
              t.quote_confirmed_at, t.escrow_locked_at, t.trader_matched_at,
              t.fiat_payout_submitted_at, t.user_confirmation_pending_at,
              t.completed_at, t.failed_at, t.created_at, t.dispute_id,
              t.stellar_deposit_tx, t.stellar_release_tx, t.payment_expires_at,
              t.appeal_expires_at, t.appeal_archived_at, t.trader_id,
              t.locked_rate, t.preferred_payout_setting_id, t.order_side,
              t.payout_reference, t.payout_proof_url,
              tr.name AS trader_name
       FROM transactions t
       LEFT JOIN traders tr ON tr.id = t.trader_id
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      result = await db.query(
        `SELECT t.id, t.state, t.xlm_amount, t.usdc_amount, t.fiat_amount, t.fiat_currency, t.network,
                t.quote_confirmed_at, t.escrow_locked_at, t.trader_matched_at,
                t.fiat_payout_submitted_at, t.user_confirmation_pending_at,
                t.completed_at, t.failed_at, t.created_at, t.dispute_id,
                t.stellar_deposit_tx, t.stellar_release_tx, t.payment_expires_at,
                t.appeal_expires_at, t.appeal_archived_at, t.trader_id,
                t.locked_rate, t.preferred_payout_setting_id, t.order_side,
                t.payout_reference, t.payout_proof_url,
                tr.name AS trader_name
         FROM transactions t
         LEFT JOIN traders tr ON tr.id = t.trader_id
         WHERE t.quote_id = $1 AND t.user_id = $2`,
        [id, userId]
      );
    }

    const tx = result.rows[0];
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    let payoutProofUrl = null;
    if (tx.payout_proof_url) {
      if (tx.payout_proof_url.startsWith('http')) {
        payoutProofUrl = tx.payout_proof_url;
      } else {
        const signed = await storageService.getSignedUrl(tx.payout_proof_url, 60 * 60 * 24 * 7);
        payoutProofUrl = signed?.url || null;
      }
    }

    let traderReceivePhone = null;
    let traderReceiveName = null;
    if (tx.order_side === 'BUY' && tx.trader_id) {
      const traderMomo = await getVerifiedTraderMomo(tx.trader_id, tx.network);
      traderReceivePhone = traderMomo?.phone_number || null;
      traderReceiveName = traderMomo?.account_name || null;
    }

    res.json({
      id: tx.id,
      state: tx.state,
      short_id: formatShortId(tx.id),
      xlm_amount: tx.xlm_amount != null ? parseFloat(tx.xlm_amount) : null,
      usdc_amount: tx.usdc_amount != null ? parseFloat(tx.usdc_amount) : null,
      fiat_amount: tx.fiat_amount != null ? parseFloat(tx.fiat_amount) : null,
      fiat_currency: tx.fiat_currency,
      network: tx.network,
      hasDispute: !!tx.dispute_id,
      stellar_deposit_tx: tx.stellar_deposit_tx,
      stellar_release_tx: tx.stellar_release_tx,
      quote_confirmed_at: tx.quote_confirmed_at,
      escrow_locked_at: tx.escrow_locked_at,
      trader_matched_at: tx.trader_matched_at,
      fiat_payout_submitted_at: tx.fiat_payout_submitted_at,
      user_confirmation_pending_at: tx.user_confirmation_pending_at,
      completed_at: tx.completed_at,
      failed_at: tx.failed_at,
      created_at: tx.created_at,
      payment_expires_at: tx.payment_expires_at,
      appeal_expires_at: tx.appeal_expires_at,
      appeal_archived_at: tx.appeal_archived_at,
      trader_id: tx.trader_id,
      trader_name: tx.trader_name,
      disputeId: tx.dispute_id,
      locked_rate: tx.locked_rate != null ? parseFloat(tx.locked_rate) : null,
      preferred_payout_setting_id: tx.preferred_payout_setting_id,
      selection_method: tx.preferred_payout_setting_id ? 'manual' : 'auto',
      order_side: tx.order_side || 'SELL',
      trader_receive_phone: traderReceivePhone,
      trader_receive_name: traderReceiveName,
      payout_reference: tx.payout_reference,
      payout_proof_url: payoutProofUrl,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cashout/receipt/:id
 * Fetch transaction receipt for display.
 * Accepts either transaction ID or quote ID.
 */
router.get('/receipt/:id', authUser, async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = req.userId;

    // Try by transaction ID first
    let result = await db.query(
      `SELECT id, xlm_amount, fiat_amount, fiat_currency, network, stellar_deposit_tx,
              stellar_release_tx, locked_rate, completed_at, fiat_sent_at, quote_confirmed_at
       FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    let tx = result.rows[0];

    // If not found by transaction ID, try by quote_id
    if (!tx) {
      result = await db.query(
        `SELECT id, xlm_amount, fiat_amount, fiat_currency, network, stellar_deposit_tx,
                stellar_release_tx, locked_rate, completed_at, fiat_sent_at, quote_confirmed_at
         FROM transactions WHERE quote_id = $1 AND user_id = $2`,
        [id, userId]
      );
      tx = result.rows[0];
    }

    if (!tx) return res.status(404).json({ error: 'Transaction receipt not found' });

    res.json({
      id: tx.id,
      xlmAmount: tx.xlm_amount,
      fiatAmount: tx.fiat_amount,
      fiatCurrency: tx.fiat_currency,
      network: tx.network,
      stellarTxHash: tx.stellar_deposit_tx,
      releaseTxHash: tx.stellar_release_tx,
      rate: tx.locked_rate,
      completedAt: tx.completed_at,
      fiatSentAt: tx.fiat_sent_at,
      confirmedAt: tx.quote_confirmed_at,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DEPRECATED: POST /api/v1/cashout/dispute
 *
 * This legacy endpoint required the obsolete FIAT_SENT state and created a
 * dispute row without holding the transaction in DISPUTE_OPENED, so escrow was
 * not reliably held and admins could not resolve it correctly.
 *
 * Canonical dispute path: POST /api/v1/user/transactions/:id/dispute
 * Returns 410 Gone so any stale client surfaces the correct endpoint.
 */
router.post('/dispute', authUser, async (req, res) => {
  return res.status(410).json({
    error: 'Endpoint deprecated',
    message: 'Open disputes via POST /api/v1/user/transactions/:id/dispute.',
    canonicalEndpoint: 'POST /api/v1/user/transactions/:id/dispute',
  });
});

export default router;
