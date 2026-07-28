/**
 * Phase 2 C1 — Execute offramp settlement after escrow lock.
 * Kotani Pay primary (sandbox); P2P trader fallback.
 */

import db from '../../db/index.js';
import logger from '../../utils/logger.js';
import stateMachine from '../transactionStateMachine.js';
import matchingEngine from '../matchingEngine.js';
import notificationService from '../notificationService.js';
import paymentRouter from './paymentRouter.js';
import kotaniPayProvider from './providers/kotaniPayProvider.js';
import yellowPayProvider from './providers/yellowPayProvider.js';
import { PAYMENT_PROVIDERS, PAYMENT_SIDES } from './paymentConstants.js';

async function loadTransaction(transactionId) {
  const result = await db.query(
    `SELECT id, state, network, fiat_amount, fiat_currency, payout_phone, payout_name,
            user_id, quote_id, payout_provider, usdc_amount
     FROM transactions WHERE id = $1`,
    [transactionId]
  );
  return result.rows[0] || null;
}

async function markAggregatorPayoutSubmitted(transaction, providerId, payoutResult) {
  await db.query(
    `UPDATE transactions
     SET payout_provider = $1,
         payment_rail = $1,
         aggregator_ref = $2,
         payout_reference = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [providerId, payoutResult.referenceId, transaction.id]
  );

  const updated = await stateMachine.transition(
    transaction.id,
    'ESCROW_LOCKED',
    'FIAT_PAYOUT_SUBMITTED',
    { payout_reference: payoutResult.referenceId }
  );

  if (!updated) {
    logger.error(`[PaymentExecutor] state transition failed for tx ${transaction.id}`);
    return false;
  }

  const label = providerId === PAYMENT_PROVIDERS.KOTANI_PAY ? 'Kotani Pay' : 'Yellow Pay';
  notificationService.notifyUser(transaction.user_id, 'aggregator_payout_submitted', {
    transactionId: transaction.id,
    state: 'FIAT_PAYOUT_SUBMITTED',
    fiat_amount: transaction.fiat_amount,
    fiat_currency: transaction.fiat_currency,
    provider: providerId,
    mock: payoutResult.mock,
    message: payoutResult.mock
      ? `Automated payout initiated (${label} sandbox). Confirm when MoMo arrives.`
      : `${label} is sending your mobile money. Confirm receipt when it arrives.`,
  }).catch(() => {});

  notificationService.createNotification(
    transaction.user_id,
    'user',
    'FIAT_PAYOUT_SUBMITTED',
    'Payment on the way',
    payoutResult.mock
      ? 'Sandbox payout initiated — confirm when you receive it.'
      : `${label} is processing your payout.`,
    transaction.id
  ).catch(() => {});

  return true;
}

async function tryKotaniPayOfframp(transaction) {
  const countryCode = paymentRouter.networkToCountryCode(transaction.network);
  if (!countryCode) return false;

  const plan = paymentRouter.resolvePaymentPlan({
    countryCode,
    side: PAYMENT_SIDES.OFFRAMP,
  });

  const kotaniInChain = [plan.primary, ...plan.fallbackChain].find(
    (p) => p?.id === PAYMENT_PROVIDERS.KOTANI_PAY && !p.unavailable
  );
  if (!kotaniInChain || plan.primary?.id !== PAYMENT_PROVIDERS.KOTANI_PAY) {
    return false;
  }

  if (!transaction.payout_phone) {
    logger.warn(`[PaymentExecutor] tx ${transaction.id} missing payout_phone — skip Kotani`);
    return false;
  }

  const reference = `ROWAN-${transaction.id.slice(0, 8)}-${Date.now()}`;
  let payoutResult;
  try {
    payoutResult = await kotaniPayProvider.sendPayout({
      countryCode,
      network: transaction.network,
      amount: parseFloat(transaction.fiat_amount),
      currency: transaction.fiat_currency,
      phone: transaction.payout_phone,
      reference,
      recipientName: transaction.payout_name || undefined,
      cryptoAmount: parseFloat(transaction.usdc_amount),
    });
  } catch (err) {
    logger.error(`[PaymentExecutor] Kotani sendPayout failed for tx ${transaction.id}: ${err.message}`, {
      body: err.body,
    });
    return false;
  }

  if (payoutResult.escrowAddress && !payoutResult.mock) {
    try {
      const escrowController = (await import('../escrowController.js')).default;
      await escrowController.sendUsdcToAggregatorEscrow({
        transactionId: transaction.id,
        destinationAddress: payoutResult.escrowAddress,
        usdcAmount: parseFloat(transaction.usdc_amount),
        aggregatorRef: payoutResult.referenceId,
      });
    } catch (sendErr) {
      logger.error(`[PaymentExecutor] USDC send to Kotani escrow failed for tx ${transaction.id}: ${sendErr.message}`);
      return false;
    }
  }

  const ok = await markAggregatorPayoutSubmitted(transaction, PAYMENT_PROVIDERS.KOTANI_PAY, payoutResult);
  if (!ok) return false;

  logger.info(`[PaymentExecutor] Kotani payout initiated for tx ${transaction.id}`, {
    referenceId: payoutResult.referenceId,
    mock: payoutResult.mock,
    escrowAddress: payoutResult.escrowAddress,
    countryCode,
  });
  return true;
}

async function tryYellowPayOfframp(transaction) {
  const countryCode = paymentRouter.networkToCountryCode(transaction.network);
  if (!countryCode) return false;

  const plan = paymentRouter.resolvePaymentPlan({
    countryCode,
    side: PAYMENT_SIDES.OFFRAMP,
  });

  if (plan.primary?.id !== PAYMENT_PROVIDERS.YELLOW_PAY || plan.primary?.unavailable) {
    return false;
  }

  if (!transaction.payout_phone) return false;

  const reference = `ROWAN-${transaction.id.slice(0, 8)}-${Date.now()}`;
  let payoutResult;
  try {
    payoutResult = await yellowPayProvider.sendPayout({
      countryCode,
      amount: parseFloat(transaction.fiat_amount),
      currency: transaction.fiat_currency,
      phone: transaction.payout_phone,
      reference,
      recipientName: transaction.payout_name || undefined,
    });
  } catch (err) {
    logger.error(`[PaymentExecutor] Yellow Pay sendPayout failed for tx ${transaction.id}: ${err.message}`);
    return false;
  }

  const ok = await markAggregatorPayoutSubmitted(transaction, PAYMENT_PROVIDERS.YELLOW_PAY, payoutResult);
  if (!ok) return false;

  logger.info(`[PaymentExecutor] Yellow Pay payout initiated for tx ${transaction.id}`, {
    referenceId: payoutResult.referenceId,
    mock: payoutResult.mock,
    countryCode,
  });
  return true;
}

/**
 * Settle an offramp after USDC/XLM escrow lock.
 * @param {string} transactionId
 */
export async function settleOfframpPayout(transactionId) {
  const transaction = await loadTransaction(transactionId);

  if (!transaction) {
    throw new Error(`Transaction ${transactionId} not found`);
  }

  if (transaction.state !== 'ESCROW_LOCKED') {
    logger.warn(`[PaymentExecutor] tx ${transactionId} state=${transaction.state}, expected ESCROW_LOCKED`);
    return { rail: transaction.payout_provider || 'skipped', skipped: true };
  }

  if (transaction.payout_provider === PAYMENT_PROVIDERS.KOTANI_PAY
    || transaction.payout_provider === PAYMENT_PROVIDERS.YELLOW_PAY) {
    return { rail: transaction.payout_provider, skipped: true };
  }

  if (await tryKotaniPayOfframp(transaction)) {
    return { rail: PAYMENT_PROVIDERS.KOTANI_PAY, automated: true };
  }

  if (await tryYellowPayOfframp(transaction)) {
    return { rail: PAYMENT_PROVIDERS.YELLOW_PAY, automated: true };
  }

  logger.info(`[PaymentExecutor] Falling back to P2P matchTrader for tx ${transactionId}`);
  await matchingEngine.matchTrader(transactionId);
  return { rail: PAYMENT_PROVIDERS.P2P_TRADER, automated: false };
}

export default {
  settleOfframpPayout,
};
