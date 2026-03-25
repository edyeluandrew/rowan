import { Router } from 'express';
import { authUser, checkUserLimits } from '../middleware/auth.js';
import { validate, validateTypes } from '../middleware/validate.js';
import quoteEngine from '../services/quoteEngine.js';
import fraudMonitor from '../services/fraudMonitor.js';
import notificationService from '../services/notificationService.js';
import config from '../config/index.js';
import db from '../db/index.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/v1/cashout/quote
 * Request a locked exchange rate.
 * Body: { xlmAmount, network, phoneHash }
 */
router.post(
  '/quote',
  authUser,
  validate(['xlmAmount', 'network', 'phoneHash']),
  validateTypes({ xlmAmount: 'positiveNumber', network: 'mobileNetwork', phoneHash: 'phoneHash' }),
  checkUserLimits,
  async (req, res, next) => {
    try {
      const { xlmAmount, network, phoneHash } = req.body;

      // ── [H-5 FIX] Enforce minimum XLM amount ──
      if (parseFloat(xlmAmount) < config.platform.minXlmAmount) {
        return res.status(400).json({
          error: `Minimum cash-out amount is ${config.platform.minXlmAmount} XLM`,
        });
      }

      // Run fraud checks before creating quote
      // [AUDIT FIX] Use actual rate from quoteEngine instead of hardcoded * 4000
      const fiatCurrency = quoteEngine.networkToFiat(network);
      const currentRate = await quoteEngine.getXlmRate(fiatCurrency);
      const fiatEstimate = parseFloat(xlmAmount) * currentRate;
      const fraudCheck = await fraudMonitor.checkTransaction(req.userId, fiatEstimate, fiatCurrency);
      if (!fraudCheck.allowed) {
        return res.status(403).json({ error: fraudCheck.reason });
      }

      const quote = await quoteEngine.createQuote({
        userId: req.userId,
        xlmAmount: parseFloat(xlmAmount),
        network,
        phoneHash,
      });

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
        userRate: quote.user_rate,
        fiatAmount: quote.fiat_amount,
        fiatCurrency: quote.fiat_currency,
        platformFee: quote.platform_fee,
        expiresAt: quote.expires_at,
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

      // Verify quote belongs to user and isn't expired
      const quoteResult = await db.query(
        `SELECT * FROM quotes WHERE id = $1 AND user_id = $2 AND is_used = FALSE`,
        [quoteId, req.userId]
      );
      const quote = quoteResult.rows[0];
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found or already used' });
      }
      if (new Date(quote.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Quote expired' });
      }

      res.json({
        status: 'PENDING_DEPOSIT',
        message: 'Transaction broadcast received. Waiting for on-chain confirmation.',
        quoteId: quote.id,
        stellarTxHash,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/cashout/status/:id
 * Poll transaction state.
 */
router.get('/status/:id', authUser, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, state, xlm_amount, usdc_amount, fiat_amount, fiat_currency,
              network, stellar_deposit_tx, stellar_swap_tx, stellar_release_tx,
              locked_rate, quote_confirmed_at, escrow_locked_at, trader_matched_at,
              fiat_sent_at, completed_at, failed_at, failure_reason, created_at
       FROM transactions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );

    const tx = result.rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    res.json(tx);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cashout/receipt/:id
 * Fetch transaction receipt for display.
 */
router.get('/receipt/:id', authUser, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, xlm_amount, fiat_amount, fiat_currency, network, stellar_deposit_tx,
              stellar_release_tx, locked_rate, completed_at, fiat_sent_at, quote_confirmed_at
       FROM transactions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );

    const tx = result.rows[0];
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
 * POST /api/v1/cashout/dispute
 * User reports non-receipt of mobile money.
 * Body: { transactionId, reason }
 */
router.post(
  '/dispute',
  authUser,
  validate(['transactionId', 'reason']),
  async (req, res, next) => {
    try {
      const { transactionId, reason } = req.body;

      // Verify transaction belongs to user and is in FIAT_SENT state
      const txResult = await db.query(
        `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND state = 'FIAT_SENT'`,
        [transactionId, req.userId]
      );
      const tx = txResult.rows[0];
      if (!tx) {
        return res.status(404).json({ error: 'Transaction not found or not in disputable state' });
      }

      // Create dispute
      const disputeResult = await db.query(
        `INSERT INTO disputes (transaction_id, user_id, trader_id, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [transactionId, req.userId, tx.trader_id, reason]
      );

      // Check if trader has 3+ open/resolved-for-user disputes → auto-suspend via fraud monitor
      const healthCheck = await fraudMonitor.checkTraderHealth(tx.trader_id);
      if (!healthCheck.healthy) {
        logger.info(`[Dispute] Trader ${tx.trader_id}: ${healthCheck.reason}`);
      }

      res.json({
        disputeId: disputeResult.rows[0].id,
        status: 'OPEN',
        message: 'Dispute filed. Escrow is held pending review.',
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
