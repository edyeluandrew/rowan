import db from '../db/index.js';
import redis from '../db/redis.js';
import buyQuoteEngine from './buyQuoteEngine.js';
import buyMatchingEngine from './buyMatchingEngine.js';
import stateMachine from './transactionStateMachine.js';
import { assertUserCanReceiveUsdc } from './userStellarService.js';
import logger from '../utils/logger.js';

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
          network, phone_hash, state, locked_rate, preferred_payout_setting_id, order_side)
       VALUES ($1,$2,0,$3,$4,$5,$6,$7,'TRADER_MATCHED',$8,$9,'BUY')
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

  const matched = await buyMatchingEngine.matchBuyTrader(transaction.id);
  if (!matched) {
    logger.warn(`[BuyOrchestrator] Match failed for buy tx ${transaction.id}`);
  }

  return transaction;
}

export default { confirmBuyOrder };
