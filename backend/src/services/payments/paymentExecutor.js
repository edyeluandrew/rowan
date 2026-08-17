/**
 * Execute offramp settlement after escrow lock.
 * MarzPay disbursement for Uganda when configured; Yellow Pay if routed;
 * P2P trader as fallback.
 */

import db from '../../db/index.js';
import logger from '../../utils/logger.js';
import stateMachine from '../transactionStateMachine.js';
import matchingEngine from '../matchingEngine.js';
import notificationService from '../notificationService.js';
import paymentRouter from './paymentRouter.js';
import yellowPayProvider from './providers/yellowPayProvider.js';
import marzPayProvider from './providers/marzPayProvider.js';
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

function aggregatorLabel(providerId) {
  if (providerId === PAYMENT_PROVIDERS.MARZ_PAY) return 'MarzPay';
  if (providerId === PAYMENT_PROVIDERS.YELLOW_PAY) return 'Yellow Pay';
  return 'Automated payout';
}

async function markAggregatorPayoutSubmitted(transaction, providerId, payoutResult) {
  await db.query(
    `UPDATE transactions
     SET payout_provider = $1,
         payment_rail = $1,
         aggregator_ref = $2,
         payout_reference = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [
      providerId,
      payoutResult.referenceId,
      payoutResult.providerUuid || payoutResult.referenceId,
      transaction.id,
    ]
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

  const label = aggregatorLabel(providerId);
  notificationService.notifyUser(transaction.user_id, 'aggregator_payout_submitted', {
    transactionId: transaction.id,
    state: 'FIAT_PAYOUT_SUBMITTED',
    fiat_amount: transaction.fiat_amount,
    fiat_currency: transaction.fiat_currency,
    provider: providerId,
    mock: payoutResult.mock,
    payout_provider: providerId,
    message: payoutResult.mock
      ? `Automated payout initiated (${label} sandbox). Check your phone for MoMo.`
      : `${label} is sending your mobile money.`,
  }).catch(() => {});

  notificationService.createNotification(
    transaction.user_id,
    'user',
    'FIAT_PAYOUT_SUBMITTED',
    'Payment on the way',
    payoutResult.mock
      ? 'Sandbox payout initiated — check your phone for MoMo.'
      : `${label} is processing your payout.`,
    transaction.id
  ).catch(() => {});

  return true;
}

async function tryMarzPayOfframp(transaction) {
  const countryCode = paymentRouter.networkToCountryCode(transaction.network);
  if (!countryCode) {
    logger.warn(`[PaymentExecutor] MarzPay skip tx ${transaction.id}: no country for network ${transaction.network}`);
    return false;
  }
  if (!marzPayProvider.isAvailable(countryCode, PAYMENT_SIDES.OFFRAMP)) {
    logger.warn(`[PaymentExecutor] MarzPay skip tx ${transaction.id}: ${marzPayProvider.unavailableReason(countryCode, PAYMENT_SIDES.OFFRAMP)}`);
    return false;
  }
  if (!transaction.payout_phone) {
    logger.warn(`[PaymentExecutor] MarzPay skip tx ${transaction.id}: missing payout_phone`);
    return false;
  }
  if (!marzPayProvider.amountInRange(transaction.fiat_amount)) {
    logger.info(`[PaymentExecutor] MarzPay amount out of range for tx ${transaction.id}`);
    return false;
  }
  const covered = await marzPayProvider.canCoverAmount(transaction.fiat_amount);
  if (!covered) {
    logger.warn(`[PaymentExecutor] MarzPay skip tx ${transaction.id}: UGX wallet cannot cover ${transaction.fiat_amount}`);
    return false;
  }

  let payoutResult;
  try {
    payoutResult = await marzPayProvider.sendPayout({
      countryCode,
      amount: parseFloat(transaction.fiat_amount),
      currency: transaction.fiat_currency,
      phone: transaction.payout_phone,
      recipientName: transaction.payout_name || undefined,
      transactionId: transaction.id,
    });
  } catch (err) {
    logger.error(`[PaymentExecutor] MarzPay sendPayout failed for tx ${transaction.id}: ${err.message}`, {
      code: err.code,
      httpStatus: err.httpStatus,
      body: err.body,
    });
    return false;
  }

  const ok = await markAggregatorPayoutSubmitted(
    transaction,
    PAYMENT_PROVIDERS.MARZ_PAY,
    payoutResult
  );
  if (!ok) return false;

  logger.info(`[PaymentExecutor] MarzPay payout initiated for tx ${transaction.id}`, {
    referenceId: payoutResult.referenceId,
    mock: payoutResult.mock,
    countryCode,
  });
  return true;
}

async function tryYellowPayOfframp(transaction) {
  const countryCode = paymentRouter.networkToCountryCode(transaction.network);
  if (!countryCode) return false;
  if (!yellowPayProvider.isAvailable(countryCode, PAYMENT_SIDES.OFFRAMP)) return false;
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

  if (
    transaction.payout_provider === PAYMENT_PROVIDERS.MARZ_PAY
    || transaction.payout_provider === PAYMENT_PROVIDERS.YELLOW_PAY
    || transaction.payout_provider === 'kotani_pay'
  ) {
    return { rail: transaction.payout_provider, skipped: true };
  }

  const countryCode = paymentRouter.networkToCountryCode(transaction.network);
  const plan = countryCode
    ? paymentRouter.resolvePaymentPlan({
      countryCode,
      side: PAYMENT_SIDES.OFFRAMP,
    })
    : { primary: null, fallbackChain: [] };

  const ordered = [plan.primary, ...(plan.fallbackChain || [])].filter(Boolean);

  for (const provider of ordered) {
    if (provider.unavailable || !provider.automated) continue;
    if (provider.id === PAYMENT_PROVIDERS.MARZ_PAY) {
      if (await tryMarzPayOfframp(transaction)) {
        return { rail: PAYMENT_PROVIDERS.MARZ_PAY, automated: true };
      }
    }
    if (provider.id === PAYMENT_PROVIDERS.YELLOW_PAY) {
      if (await tryYellowPayOfframp(transaction)) {
        return { rail: PAYMENT_PROVIDERS.YELLOW_PAY, automated: true };
      }
    }
  }

  const marzAvailable = ordered.some(
    (provider) => provider.id === PAYMENT_PROVIDERS.MARZ_PAY && !provider.unavailable
  );
  if (marzAvailable) {
    logger.warn(`[PaymentExecutor] MarzPay did not pay tx ${transactionId}; falling back to P2P trader`);
  }

  logger.info(`[PaymentExecutor] Matching P2P trader for tx ${transactionId}`);
  await matchingEngine.matchTrader(transactionId);
  return { rail: PAYMENT_PROVIDERS.P2P_TRADER, automated: false };
}

export default {
  settleOfframpPayout,
};
