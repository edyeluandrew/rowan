import db from '../db/index.js';
import redis from '../db/redis.js';
import buyQuoteEngine from './buyQuoteEngine.js';
import buyMatchingEngine from './buyMatchingEngine.js';
import stateMachine from './transactionStateMachine.js';
import { assertUserCanReceiveUsdc } from './userStellarService.js';
import logger from '../utils/logger.js';
import paymentRouter from './payments/paymentRouter.js';
import marzPayProvider from './payments/providers/marzPayProvider.js';
import { PAYMENT_PROVIDERS, PAYMENT_SIDES } from './payments/paymentConstants.js';
import notificationService from './notificationService.js';

/**
 * Confirm a buy quote — creates transaction and matches trader (no XLM deposit).
 */
async function confirmBuyOrder({ quoteId, userId }) {
  const quote = await buyQuoteEngine.getBuyQuoteById(quoteId, userId);
  if (!quote) {
    const err = new Error('Quote not found');
    err.statusCode = 404;
    throw err;
  }
  if (new Date(quote.expires_at) < new Date()) {
    const err = new Error('Quote expired');
    err.statusCode = 410;
    throw err;
  }
  if (quote.is_used) {
    const existing = await db.query(`SELECT id, state FROM transactions WHERE quote_id = $1`, [quoteId]);
    if (existing.rows[0]) return existing.rows[0];
    const err = new Error('Quote already used');
    err.statusCode = 409;
    throw err;
  }

  const userResult = await db.query(`SELECT stellar_address FROM users WHERE id = $1`, [userId]);
  await assertUserCanReceiveUsdc(userResult.rows[0]?.stellar_address);

  const lockKey = `lock:buy-confirm:${quoteId}`;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');
  if (!lockAcquired) {
    const err = new Error('Confirm already in progress');
    err.statusCode = 409;
    throw err;
  }

  const client = await db.getClient();
  let transaction;
  try {
    await client.query('BEGIN');

    const markResult = await client.query(
      `UPDATE quotes SET is_used = TRUE, status = 'CONFIRMED'
       WHERE id = $1 AND is_used = FALSE RETURNING id`,
      [quoteId]
    );
    if (markResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const existing = await db.query(`SELECT * FROM transactions WHERE quote_id = $1`, [quoteId]);
      if (existing.rows[0]) return existing.rows[0];
      const err = new Error('Quote already used');
      err.statusCode = 409;
      throw err;
    }

    const usdcAmount = Number(quote.path_usdc_received);
    const txResult = await client.query(
      `INSERT INTO transactions
         (quote_id, user_id, xlm_amount, usdc_amount, fiat_amount, fiat_currency,
          network, phone_hash, state, locked_rate, preferred_payout_setting_id, order_side,
          payout_phone, payout_name)
       VALUES ($1,$2,0,$3,$4,$5,$6,$7,'TRADER_MATCHED',$8,$9,'BUY',$10,$11)
       RETURNING *`,
      [
        quote.id,
        userId,
        usdcAmount,
        Number(quote.fiat_amount),
        quote.fiat_currency,
        quote.network,
        quote.phone_hash,
        Number(quote.user_rate),
        quote.preferred_payout_setting_id,
        quote.payout_phone || null,
        quote.payout_name || null,
      ]
    );
    transaction = txResult.rows[0];
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await redis.del(lockKey);
  }

  logger.info(`[BuyOrchestrator] Created buy tx ${transaction.id} for quote ${quoteId}`);

  if (await tryMarzPayOnramp(transaction)) {
    const refreshed = await db.query(`SELECT * FROM transactions WHERE id = $1`, [transaction.id]);
    return refreshed.rows[0] || transaction;
  }

  const matched = await buyMatchingEngine.matchBuyTrader(transaction.id);
  if (!matched) {
    logger.warn(`[BuyOrchestrator] Match failed for buy tx ${transaction.id}`);
  }

  return transaction;
}

async function tryMarzPayOnramp(transaction) {
  if (transaction.preferred_payout_setting_id) return false;
  const countryCode = paymentRouter.networkToCountryCode(transaction.network);
  if (!countryCode) return false;
  if (!paymentRouter.getProviderChain(countryCode, PAYMENT_SIDES.ONRAMP).includes(PAYMENT_PROVIDERS.MARZ_PAY)) {
    return false;
  }
  if (!marzPayProvider.isAvailable(countryCode, PAYMENT_SIDES.ONRAMP)) return false;
  if (!transaction.payout_phone) {
    logger.warn(`[BuyOrchestrator] MarzPay collect skip tx ${transaction.id}: missing payout_phone`);
    return false;
  }
  if (!marzPayProvider.amountInRange(transaction.fiat_amount)) return false;

  let collection;
  try {
    collection = await marzPayProvider.initiateCollection({
      countryCode,
      amount: parseFloat(transaction.fiat_amount),
      currency: transaction.fiat_currency,
      phone: transaction.payout_phone,
      transactionId: transaction.id,
    });
  } catch (err) {
    logger.error(`[BuyOrchestrator] MarzPay collect failed for tx ${transaction.id}: ${err.message}`, {
      code: err.code,
      httpStatus: err.httpStatus,
      body: err.body,
    });
    return false;
  }

  await db.query(
    `UPDATE transactions
     SET payout_provider = $1,
         payment_rail = $1,
         aggregator_ref = $2,
         payout_reference = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [
      PAYMENT_PROVIDERS.MARZ_PAY,
      collection.referenceId,
      collection.providerUuid || collection.referenceId,
      transaction.id,
    ]
  );

  const moved = await stateMachine.transition(
    transaction.id,
    'TRADER_MATCHED',
    'FIAT_PAYOUT_SUBMITTED',
    { payout_reference: collection.referenceId }
  );
  if (!moved) return false;

  notificationService.notifyUser(transaction.user_id, 'aggregator_collection_submitted', {
    transactionId: transaction.id,
    state: 'FIAT_PAYOUT_SUBMITTED',
    fiat_amount: transaction.fiat_amount,
    fiat_currency: transaction.fiat_currency,
    provider: PAYMENT_PROVIDERS.MARZ_PAY,
    mock: collection.mock,
    payout_provider: PAYMENT_PROVIDERS.MARZ_PAY,
    message: collection.mock
      ? 'Sandbox collection started. Approve the test prompt if shown.'
      : 'Approve the MTN or Airtel prompt on your phone to pay.',
  }).catch(() => {});

  if (collection.mock) {
    try {
      const escrowController = (await import('./escrowController.js')).default;
      await escrowController.completeMarzPayBuy(transaction.id);
    } catch (err) {
      logger.warn(`[BuyOrchestrator] mock buy complete failed for tx ${transaction.id}: ${err.message}`);
    }
  }

  logger.info(`[BuyOrchestrator] MarzPay collect initiated for tx ${transaction.id}`, {
    referenceId: collection.referenceId,
    mock: collection.mock,
  });
  return true;
}

export default { confirmBuyOrder };
