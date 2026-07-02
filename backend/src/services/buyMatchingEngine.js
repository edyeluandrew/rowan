import db from '../db/index.js';
import redis from '../db/redis.js';
import config from '../config/index.js';
import stateMachine from './transactionStateMachine.js';
import payoutSettingsService from './payoutSettingsService.js';
import notificationService from './notificationService.js';
import { getTraderUsdcTrustlineStatus, assertTraderCanReceiveUsdc } from './traderStellarService.js';
import { fiatToUgx } from '../utils/financial.js';
import logger from '../utils/logger.js';

let chatServiceModule = null;
async function getChatService() {
  if (!chatServiceModule) {
    chatServiceModule = (await import('./chatService.js')).default;
  }
  return chatServiceModule;
}

function formatFiatDisplay(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  return `${Math.round(n).toLocaleString()} ${currency}`;
}

/**
 * Match a BUY order to a trader with USDC inventory (manual P2P only).
 */
async function matchBuyTrader(transactionId) {
  const lockKey = `lock:match-buy:${transactionId}`;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', config.platform.redisLockTtlMatchSeconds, 'NX');
  if (!lockAcquired) return null;

  try {
    const txResult = await db.query(`SELECT * FROM transactions WHERE id = $1`, [transactionId]);
    const transaction = txResult.rows[0];
    if (!transaction || transaction.order_side !== 'BUY') return null;
    if (transaction.state !== 'TRADER_MATCHED' || transaction.trader_id) {
      return transaction?.trader_id ? { id: transaction.trader_id } : null;
    }

    const fiatNeeded = parseFloat(transaction.fiat_amount);
    const usdcNeeded = parseFloat(transaction.usdc_amount);
    const fiatCurrency = transaction.fiat_currency;
    const fiatAmountUgx = fiatToUgx(fiatNeeded, fiatCurrency);
    const preferredSettingId = transaction.preferred_payout_setting_id;
    const orderUserId = transaction.user_id;

    if (!preferredSettingId) {
      logger.error(`[BuyMatching] Tx ${transactionId} missing preferred_payout_setting_id`);
      return null;
    }

    const candidateResult = await db.query(
      `SELECT t.id AS trader_id, t.name AS trader_name, t.stellar_address,
              ps.id AS payout_setting_id, ps.available_usdc, ps.reserved_usdc,
              ps.min_amount, ps.max_amount
       FROM traders t
       JOIN trader_payout_settings ps ON ps.trader_id = t.id
       WHERE t.status = 'ACTIVE'
         AND t.verification_status = 'VERIFIED'
         AND t.stellar_address IS NOT NULL
         AND ps.is_active = TRUE
         AND ps.ad_side = 'USER_BUY'
         AND ps.id = $1
         AND ps.network = $2::mobile_network
         AND ps.currency = $3
         AND $4 BETWEEN ps.min_amount AND ps.max_amount
         AND (ps.available_usdc - ps.reserved_usdc) >= $5
         AND (t.daily_volume + $6) <= t.daily_limit_ugx
         AND (SELECT COUNT(*) FROM transactions tx
                WHERE tx.trader_id = t.id
                  AND tx.state IN ('TRADER_MATCHED','FIAT_PAYOUT_SUBMITTED','USER_CONFIRMATION_PENDING'))
             < COALESCE(t.max_concurrent_orders, 3)
         AND t.id NOT IN (SELECT trader_id FROM blocked_traders WHERE user_id = $7)
       LIMIT 1`,
      [preferredSettingId, transaction.network, fiatCurrency, fiatNeeded, usdcNeeded, fiatAmountUgx, orderUserId]
    );

    const candidate = candidateResult.rows[0];
    if (!candidate) {
      logger.warn(`[BuyMatching] Preferred buy ad ${preferredSettingId} unavailable for tx ${transactionId}`);
      return null;
    }

    const trustStatus = await getTraderUsdcTrustlineStatus(candidate.stellar_address);
    if (!trustStatus.hasTrustline) {
      logger.warn(`[BuyMatching] Trader ${candidate.trader_id} missing USDC trustline`);
      return null;
    }

    const upd = await db.query(
      `UPDATE transactions
       SET trader_id = $1, payout_setting_id = $2, trader_matched_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND trader_id IS NULL AND state = 'TRADER_MATCHED' AND order_side = 'BUY'
       RETURNING *`,
      [candidate.trader_id, candidate.payout_setting_id, transactionId]
    );
    if (!upd.rows[0]) return null;

    try {
      await payoutSettingsService.reserveUsdcFloat(candidate.payout_setting_id, usdcNeeded);
    } catch (reserveErr) {
      logger.warn(`[BuyMatching] USDC reservation failed: ${reserveErr.message}`);
      await db.query(
        `UPDATE transactions SET trader_id = NULL, payout_setting_id = NULL WHERE id = $1`,
        [transactionId]
      );
      return null;
    }

    const chatService = await getChatService();
    chatService.sendSystemMessage(
      transactionId,
      'Trader matched. They will lock USDC in escrow after accepting your order.'
    ).catch(() => {});

    notificationService.notifyUser(transaction.user_id, 'trader_matched', {
      transactionId,
      state: 'TRADER_MATCHED',
      message: 'Trader matched. Waiting for them to accept and lock USDC.',
    }).catch(() => {});

    const acceptTimeoutMs = (config.platform.traderAcceptTimeoutSeconds || 180) * 1000;
    await notificationService.notifyTraderNewRequest(candidate.trader_id, {
      id: transactionId,
      transactionId,
      order_side: 'BUY',
      usdc_amount: usdcNeeded,
      fiat_amount: fiatNeeded,
      fiat_currency: fiatCurrency,
      network: transaction.network,
      state: 'TRADER_MATCHED',
      accept_deadline: new Date(Date.now() + acceptTimeoutMs).toISOString(),
    });

    return { id: candidate.trader_id, name: candidate.trader_name };
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Trader accepts a BUY request — starts window for trader to lock USDC.
 */
async function acceptBuyRequest(transactionId, traderId) {
  const checkBefore = await db.query(
    `SELECT * FROM transactions WHERE id = $1 AND order_side = 'BUY'`,
    [transactionId]
  );
  const beforeState = checkBefore.rows[0];
  if (!beforeState || beforeState.trader_id !== traderId) {
    const err = new Error('Request not found or not assigned to you');
    err.statusCode = 404;
    throw err;
  }
  if (beforeState.state !== 'TRADER_MATCHED') {
    const err = new Error(`Request already in state ${beforeState.state}`);
    err.statusCode = 410;
    throw err;
  }

  if (!beforeState.matched_at) {
    await assertTraderCanReceiveUsdc(
      (await db.query(`SELECT stellar_address FROM traders WHERE id = $1`, [traderId])).rows[0]?.stellar_address
    );
  }

  const result = await db.query(
    `UPDATE transactions SET matched_at = NOW()
     WHERE id = $1 AND trader_id = $2 AND state = 'TRADER_MATCHED' AND matched_at IS NULL
     RETURNING *`,
    [transactionId, traderId]
  );

  let transaction = result.rows[0];
  if (!transaction) {
    const existing = await db.query(
      `SELECT * FROM transactions WHERE id = $1 AND trader_id = $2 AND matched_at IS NOT NULL`,
      [transactionId, traderId]
    );
    transaction = existing.rows[0];
    if (!transaction) {
      const err = new Error('Request expired or already handled');
      err.statusCode = 409;
      throw err;
    }
  } else {
    const quoteResult = await db.query(`SELECT memo, escrow_address FROM quotes WHERE id = $1`, [transaction.quote_id]);
    const quote = quoteResult.rows[0];

    const lockWindowSeconds = config.platform.paymentWindowSeconds;
    const lockExpiresAt = new Date(Date.now() + lockWindowSeconds * 1000);
    await db.query(
      `UPDATE transactions SET payment_expires_at = $1 WHERE id = $2`,
      [lockExpiresAt, transactionId]
    );

    const chatService = await getChatService();
    chatService.sendSystemMessage(
      transactionId,
      `Trader accepted. Send exactly ${Number(transaction.usdc_amount).toFixed(4)} USDC to escrow with memo "${quote?.memo || ''}" to lock funds.`
    ).catch(() => {});

    notificationService.notifyUser(transaction.user_id, 'trader_accepted_buy', {
      transactionId,
      usdcAmount: transaction.usdc_amount,
      escrowAddress: quote?.escrow_address,
      memo: quote?.memo,
      lockExpiresAt: lockExpiresAt.toISOString(),
    }).catch(() => {});
  }

  const quoteRow = await db.query(`SELECT memo, escrow_address FROM quotes WHERE id = $1`, [transaction.quote_id]);

  return {
    transactionId: transaction.id,
    usdcAmount: transaction.usdc_amount,
    fiatAmount: transaction.fiat_amount,
    fiatCurrency: transaction.fiat_currency,
    escrowAddress: quoteRow.rows[0]?.escrow_address,
    memo: quoteRow.rows[0]?.memo,
    confirmDeadlineSeconds: config.platform.paymentWindowSeconds,
  };
}

/**
 * User submits MoMo payment proof (after trader USDC is locked).
 */
async function submitUserPaymentSent(transactionId, userId, paymentReference, { proofStorageKey = null, proofSignedUrl = null } = {}) {
  const txCheck = await db.query(
    `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND order_side = 'BUY'`,
    [transactionId, userId]
  );
  const tx = txCheck.rows[0];
  if (!tx) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }
  if (tx.state !== 'ESCROW_LOCKED') {
    const err = new Error(`Cannot submit payment — transaction is in state ${tx.state}, expected ESCROW_LOCKED`);
    err.statusCode = 409;
    throw err;
  }

  const transitionMeta = { payout_reference: paymentReference };
  if (proofStorageKey) transitionMeta.payout_proof_url = proofStorageKey;

  const transaction = await stateMachine.transition(
    transactionId,
    'ESCROW_LOCKED',
    'FIAT_PAYOUT_SUBMITTED',
    transitionMeta
  );
  if (!transaction) {
    const err = new Error('State transition failed');
    err.statusCode = 409;
    throw err;
  }

  const chatService = await getChatService();
  chatService.sendPaymentProofMessage(transactionId, {
    type: 'payment_proof',
    reference: paymentReference,
    proof_url: proofSignedUrl || null,
    amount: formatFiatDisplay(transaction.fiat_amount, transaction.fiat_currency),
    network: transaction.network,
    submitted_at: new Date().toISOString(),
    from: 'user',
  }).catch(() => {});

  notificationService.notifyTrader(transaction.trader_id, 'user_sent_payment', {
    transactionId,
    state: 'FIAT_PAYOUT_SUBMITTED',
    reference: paymentReference,
    fiat_amount: transaction.fiat_amount,
    fiat_currency: transaction.fiat_currency,
  }).catch(() => {});

  return transaction;
}

/**
 * Trader confirms MoMo received — triggers USDC release to user.
 */
async function confirmFiatReceived(transactionId, traderId) {
  const txCheck = await db.query(
    `SELECT * FROM transactions WHERE id = $1 AND trader_id = $2 AND order_side = 'BUY'`,
    [transactionId, traderId]
  );
  const tx = txCheck.rows[0];
  if (!tx) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }
  if (tx.state !== 'FIAT_PAYOUT_SUBMITTED') {
    const err = new Error(`Cannot confirm — transaction is in state ${tx.state}`);
    err.statusCode = 409;
    throw err;
  }

  const transaction = await stateMachine.transition(
    transactionId,
    'FIAT_PAYOUT_SUBMITTED',
    'USER_CONFIRMATION_PENDING',
    {}
  );
  if (!transaction) {
    const err = new Error('State transition failed');
    err.statusCode = 409;
    throw err;
  }

  const escrowController = (await import('./escrowController.js')).default;
  const releaseHash = await escrowController.releaseToUser(transactionId);

  return { transaction, releaseHash };
}

export default {
  matchBuyTrader,
  acceptBuyRequest,
  submitUserPaymentSent,
  confirmFiatReceived,
};
