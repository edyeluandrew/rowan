import { Router } from 'express';
import { authUser, checkUserLimits } from '../middleware/auth.js';
import { validate, validateTypes } from '../middleware/validate.js';
import quoteEngine from '../services/quoteEngine.js';
import fraudMonitor from '../services/fraudMonitor.js';
import notificationService from '../services/notificationService.js';
import config from '../config/index.js';
import db from '../db/index.js';
import logger from '../utils/logger.js';
import { stroopsToUsdc } from '../utils/financial.js';

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
      
      logger.info(`[Cashout] getQuote called: xlmAmount=${xlmAmount} (type: ${typeof xlmAmount}), network=${network}, phoneHash=${phoneHash?.slice(0, 8)}...`);

      // ── [H-5 FIX] Enforce minimum XLM amount ──
      const xlmNum = typeof xlmAmount === 'string' ? parseFloat(xlmAmount) : xlmAmount;
      if (!Number.isFinite(xlmNum) || xlmNum <= 0) {
        logger.warn(`[Cashout] Invalid xlmAmount: ${xlmAmount} (parsed: ${xlmNum}, finite: ${Number.isFinite(xlmNum)})`);
        return res.status(400).json({
          error: `XLM amount must be a positive number (got: ${xlmAmount}, type: ${typeof xlmAmount})`,
        });
      }
      
      if (xlmNum < config.platform.minXlmAmount) {
        logger.warn(`[Cashout] xlmAmount below minimum: ${xlmNum} < ${config.platform.minXlmAmount}`);
        return res.status(400).json({
          error: `Minimum cash-out amount is ${config.platform.minXlmAmount} XLM`,
        });
      }

      // Run fraud checks before creating quote
      // [PHASE 2 UPGRADE] Use legacy rate for fraud estimate (real path will be discovered during quote creation)
      const fiatCurrency = quoteEngine.networkToFiat(network);
      let currentRate;
      try {
        currentRate = await quoteEngine.getLegacyXlmRate(fiatCurrency);
      } catch (err) {
        logger.warn(`[Cashout] Legacy rate fetch for fraud check failed:`, err.message);
        return res.status(503).json({ error: 'Unable to fetch rates. Please try again.' });
      }
      
      const fiatEstimate = xlmNum * currentRate;
      const fraudCheck = await fraudMonitor.checkTransaction(req.userId, fiatEstimate, fiatCurrency);
      if (!fraudCheck.allowed) {
        logger.warn(`[Cashout] Fraud check failed: ${fraudCheck.reason}`);
        return res.status(403).json({ error: fraudCheck.reason });
      }

      logger.info(`[Cashout] ✅ Fraud check passed. Creating quote: xlmAmount=${xlmNum}, network=${network}`);
      
      // [PHASE 2] Create quote using real Horizon path discovery
      // This will throw if no valid path is found
      let quote;
      try {
        quote = await quoteEngine.createQuote({
          userId: req.userId,
          xlmAmount: xlmNum,
          network,
          phoneHash,
        });
      } catch (quoteErr) {
        logger.error(`[Cashout] Quote creation failed:`, quoteErr.message);
        // Return 503 for transient errors (no liquidity) or 400 for permanent errors
        if (quoteErr.message.includes('No valid path') || quoteErr.message.includes('No liquidity')) {
          return res.status(503).json({ 
            error: 'Liquidity unavailable right now. Please try again later.' 
          });
        }
        return res.status(503).json({ 
          error: 'Unable to generate quote. Please try again.' 
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
        return res.status(404).json({ error: 'Quote not found or already used' });
      }
      
      logger.info(`[Cashout] Quote found: id=${quote.id}, is_used=${quote.is_used}, expires_at=${quote.expires_at}`);
      
      if (quote.is_used) {
        logger.warn(`[Cashout] Quote already used: ${quote.id}`);
        return res.status(404).json({ error: 'Quote has already been used' });
      }
      
      if (new Date(quote.expires_at) < new Date()) {
        logger.warn(`[Cashout] Quote expired: ${quote.id}, expired at ${quote.expires_at}`);
        return res.status(410).json({ error: 'Quote expired' });
      }

      logger.info(`[Cashout] ✅ confirmQuote successful for quote ${quote.id}, tx: ${stellarTxHash}`);

      res.json({
        status: 'PENDING_DEPOSIT',
        message: 'Transaction broadcast received. Waiting for on-chain confirmation.',
        quoteId: quote.id,
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
 * Poll transaction state.
 * Accepts either transactionId OR quoteId
 */
router.get('/status/:id', authUser, async (req, res, next) => {
  try {
    const id = req.params.id;
    
    logger.info(`[Cashout] status query for id: ${id}, userId: ${req.userId}`);

    // Try to find by transaction ID first
    let result = await db.query(
      `SELECT id, state, xlm_amount, usdc_amount, fiat_amount, fiat_currency,
              network, stellar_deposit_tx, stellar_swap_tx, stellar_release_tx,
              locked_rate, quote_confirmed_at, escrow_locked_at, trader_matched_at,
              fiat_sent_at, completed_at, failed_at, failure_reason, created_at
       FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    // If not found, try by quote_id
    if (result.rows.length === 0) {
      logger.info(`[Cashout] Transaction not found by ID, trying quote_id: ${id}`);
      result = await db.query(
        `SELECT id, state, xlm_amount, usdc_amount, fiat_amount, fiat_currency,
                network, stellar_deposit_tx, stellar_swap_tx, stellar_release_tx,
                locked_rate, quote_confirmed_at, escrow_locked_at, trader_matched_at,
                fiat_sent_at, completed_at, failed_at, failure_reason, created_at
         FROM transactions WHERE quote_id = $1 AND user_id = $2`,
        [id, req.userId]
      );
    }

    const tx = result.rows[0];
    if (!tx) {
      logger.warn(`[Cashout] Transaction not found for id: ${id}, userId: ${req.userId}`);
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    logger.info(`[Cashout] ✅ Status found for tx ${tx.id}, state: ${tx.state}`);

    // Convert stroops to decimal USDC
    const response = {
      ...tx,
      usdc_amount: stroopsToUsdc(tx.usdc_amount),
    };

    res.json(response);
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
