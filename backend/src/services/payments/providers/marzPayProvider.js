/**
 * MarzPay automated offramp — Send Money (disbursement) only.
 * Collections / buy are not wired here.
 */

import crypto from 'crypto';
import config from '../../../config/index.js';
import logger from '../../../utils/logger.js';
import {
  marzPayIsMock as clientIsMock,
  sendMoney,
  getSendMoney,
  formatMarzPhone,
  verifyWebhookSignature as verifyMarzSignature,
} from '../../utilities/marzPayClient.js';
import { PAYMENT_PROVIDERS, PAYMENT_SIDES } from '../paymentConstants.js';

const STELLAR_G_REGEX = /^G[A-Z2-7]{55}$/;

function marzConfig() {
  return config.marzPay || {};
}

export function marzPayIsMock() {
  return clientIsMock();
}

export function getSettlementAddress() {
  return String(marzConfig().settlementStellarAddress || '').trim();
}

export function getFeeAddress() {
  return String(marzConfig().feeStellarAddress || '').trim();
}

function corridorEnabled(countryCode) {
  const cfg = marzConfig();
  if (!cfg.enabled) return false;
  return (cfg.offrampCountries || []).includes(String(countryCode || '').toUpperCase());
}

export function isAvailable(countryCode, side = PAYMENT_SIDES.OFFRAMP) {
  if (String(side).toLowerCase() !== PAYMENT_SIDES.OFFRAMP) return false;
  if (!corridorEnabled(countryCode)) return false;
  return STELLAR_G_REGEX.test(getSettlementAddress());
}

export function unavailableReason(countryCode, side = PAYMENT_SIDES.OFFRAMP) {
  const cfg = marzConfig();
  if (!cfg.enabled) return 'MarzPay disabled in config';
  if (String(side).toLowerCase() !== PAYMENT_SIDES.OFFRAMP) {
    return 'MarzPay onramp (collections) is not enabled yet';
  }
  const code = String(countryCode || '').toUpperCase();
  if (!corridorEnabled(code)) return `Corridor ${code} not enabled for MarzPay offramp`;
  if (!marzPayIsMock() && !STELLAR_G_REGEX.test(getSettlementAddress())) {
    return 'MARZPAY_SETTLEMENT_STELLAR is not a valid Stellar address';
  }
  return `MarzPay unavailable for ${side} in ${code}`;
}

export function amountInRange(amount) {
  const cfg = marzConfig();
  const n = Number(amount);
  if (!Number.isFinite(n)) return false;
  return n >= cfg.sendMoneyMinFiat && n <= cfg.sendMoneyMaxFiat;
}

export async function sendPayout({
  countryCode,
  amount,
  currency,
  phone,
  reference,
  recipientName,
  transactionId,
}) {
  const cfg = marzConfig();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(reference || ''))
    ? String(reference)
    : crypto.randomUUID();

  if (!amountInRange(amount)) {
    const err = new Error(
      `MarzPay amount ${amount} ${currency} is outside ${cfg.sendMoneyMinFiat}–${cfg.sendMoneyMaxFiat}`
    );
    err.code = 'MARZPAY_AMOUNT_OUT_OF_RANGE';
    throw err;
  }

  const callbackUrl = cfg.webhookUrl || undefined;
  const body = await sendMoney({
    amount,
    phoneNumber: phone,
    country: countryCode,
    reference: uuid,
    description: recipientName
      ? `Rowan cash-out ${String(recipientName).slice(0, 80)}`
      : 'Rowan cash-out',
    callbackUrl,
    metadata: [
      { orderId: String(transactionId || uuid) },
      { currency: String(currency || 'UGX') },
    ],
  });

  const tx = body?.data?.transaction || {};
  logger.info('[MarzPay] sendPayout accepted', {
    reference: uuid,
    providerUuid: tx.uuid,
    status: tx.status,
    mock: Boolean(body?._mock || marzPayIsMock()),
  });

  return {
    referenceId: uuid,
    providerUuid: tx.uuid || null,
    status: String(tx.status || 'processing').toUpperCase(),
    provider: PAYMENT_PROVIDERS.MARZ_PAY,
    mock: Boolean(body?._mock || marzPayIsMock()),
    phone: formatMarzPhone(phone),
    raw: body,
  };
}

export async function getPayoutStatus(referenceId) {
  return getSendMoney(referenceId);
}

export function verifyWebhookSignature({ rawBody, timestamp, signatureHeader }) {
  return verifyMarzSignature({ rawBody, timestamp, signatureHeader });
}

export default {
  marzPayIsMock,
  getSettlementAddress,
  getFeeAddress,
  isAvailable,
  unavailableReason,
  amountInRange,
  sendPayout,
  getPayoutStatus,
  verifyWebhookSignature,
};
