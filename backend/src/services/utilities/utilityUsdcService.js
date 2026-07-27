/**
 * B6 — Verify on-chain USDC payment for utility purchases.
 */

import config from '../../config/index.js';
import db from '../../db/index.js';
import { server as horizon, USDC_ASSET } from '../../config/stellar.js';
import logger from '../../utils/logger.js';

export function getUtilityTreasuryPublicKey() {
  const key = config.utilities.treasuryPublicKey;
  if (!key) {
    const err = new Error('Utility USDC treasury not configured');
    err.status = 503;
    throw err;
  }
  return key;
}

function isUsdcPayment(payment) {
  const issuer = USDC_ASSET.getIssuer();
  return (
    (payment.asset_type === 'credit_alphanum4' || payment.asset_type === 'credit_alphanum12')
    && payment.asset_code === USDC_ASSET.code
    && (payment.asset_issuer === issuer || payment.asset_issuer === undefined)
  );
}

/**
 * Verify a Stellar tx sends the expected USDC to treasury with matching memo.
 */
export async function verifyUtilityUsdcPayment({
  paymentTxHash,
  expectedFrom,
  expectedUsdc,
  expectedMemo,
}) {
  if (!paymentTxHash) {
    return { ok: false, code: 'PAYMENT_TX_REQUIRED', reason: 'paymentTxHash is required' };
  }

  const used = await db.query(
    `SELECT id FROM utility_purchases WHERE payment_tx_hash = $1 LIMIT 1`,
    [paymentTxHash]
  );
  if (used.rows[0]) {
    return { ok: false, code: 'PAYMENT_TX_REUSED', reason: 'This payment was already used' };
  }

  const treasury = getUtilityTreasuryPublicKey();
  const tolerance = config.platform.usdcAmountMismatchTolerance || 0.0000001;

  let tx;
  try {
    tx = await horizon.transactions().transaction(paymentTxHash).call();
  } catch (err) {
    logger.warn('[UtilityUsdc] tx load failed', { hash: paymentTxHash, error: err.message });
    return { ok: false, code: 'PAYMENT_TX_NOT_FOUND', reason: 'Transaction not found on Horizon' };
  }

  const memo = tx.memo || '';
  if (expectedMemo && memo !== expectedMemo) {
    return {
      ok: false,
      code: 'PAYMENT_MEMO_MISMATCH',
      reason: `Expected memo "${expectedMemo}", got "${memo || '(empty)'}"`,
    };
  }

  const ops = await horizon.operations().forTransaction(paymentTxHash).call();
  const payments = ops.records.filter((op) => op.type === 'payment' && isUsdcPayment(op));

  for (const payment of payments) {
    if (payment.to !== treasury) continue;
    if (expectedFrom && payment.from !== expectedFrom) {
      return {
        ok: false,
        code: 'PAYMENT_WRONG_SENDER',
        reason: `Payment must come from ${expectedFrom}`,
        actualFrom: payment.from,
      };
    }

    const amount = Number(payment.amount);
    if (Math.abs(amount - expectedUsdc) > tolerance) {
      return {
        ok: false,
        code: 'PAYMENT_AMOUNT_MISMATCH',
        reason: `Expected ${expectedUsdc} USDC, received ${amount} USDC`,
        actualAmount: amount,
      };
    }

    return {
      ok: true,
      from: payment.from,
      to: payment.to,
      amount,
      memo,
      txHash: paymentTxHash,
    };
  }

  return {
    ok: false,
    code: 'PAYMENT_NOT_FOUND',
    reason: `No USDC payment to ${treasury} found in transaction`,
  };
}

export default {
  getUtilityTreasuryPublicKey,
  verifyUtilityUsdcPayment,
};
