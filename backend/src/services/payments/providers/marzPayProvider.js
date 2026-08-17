/**
 * MarzPay rails:
 *   cash-out → Send Money (disbursement)
 *   buy      → Collect Money
 * Same UGX wallet: collections fund disbursements.
 */

import config from '../../../config/index.js';
import logger from '../../../utils/logger.js';
import {
  marzPayIsMock as clientIsMock,
  sendMoney,
  getSendMoney,
  collectMoney,
  getCollectMoney,
  getWalletBalance,
  parseAvailableBalance,
  formatMarzPhone,
  marzPayReference,
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

export function getInventorySecret() {
  return String(marzConfig().settlementSecret || '').trim()
    || String(config.testnetFaucet?.secretKey || '').trim()
    || String(config.stellar?.marketMakerSecretKey || '').trim();
}

function countriesFor(side) {
  const cfg = marzConfig();
  if (String(side).toLowerCase() === PAYMENT_SIDES.ONRAMP) {
    return cfg.onrampCountries || cfg.offrampCountries || [];
  }
  return cfg.offrampCountries || [];
}

function corridorEnabled(countryCode, side) {
  const cfg = marzConfig();
  if (!cfg.enabled) return false;
  return countriesFor(side).includes(String(countryCode || '').toUpperCase());
}

export function isAvailable(countryCode, side = PAYMENT_SIDES.OFFRAMP) {
  const normalized = String(side || '').toLowerCase();
  if (!corridorEnabled(countryCode, normalized)) return false;
  if (marzPayIsMock()) return true;
  if (normalized === PAYMENT_SIDES.ONRAMP) return Boolean(getInventorySecret());
  return STELLAR_G_REGEX.test(getSettlementAddress());
}

export function unavailableReason(countryCode, side = PAYMENT_SIDES.OFFRAMP) {
  const cfg = marzConfig();
  if (!cfg.enabled) return 'MarzPay disabled in config';
  const normalized = String(side || '').toLowerCase();
  const code = String(countryCode || '').toUpperCase();
  if (!corridorEnabled(code, normalized)) {
    return `Corridor ${code} not enabled for MarzPay ${normalized}`;
  }
  if (normalized === PAYMENT_SIDES.ONRAMP && !marzPayIsMock() && !getInventorySecret()) {
    return 'MarzPay buy needs MARZPAY_SETTLEMENT_SECRET (Rowan USDC inventory)';
  }
  if (normalized === PAYMENT_SIDES.OFFRAMP && !marzPayIsMock() && !STELLAR_G_REGEX.test(getSettlementAddress())) {
    return 'MARZPAY_SETTLEMENT_STELLAR is not a valid Stellar address';
  }
  return `MarzPay unavailable for ${normalized} in ${code}`;
}

export function amountInRange(amount) {
  const cfg = marzConfig();
  const n = Number(amount);
  if (!Number.isFinite(n)) return false;
  return n >= cfg.sendMoneyMinFiat && n <= cfg.sendMoneyMaxFiat;
}

export async function getAvailableUgx() {
  if (marzPayIsMock()) return Number.POSITIVE_INFINITY;
  try {
    const body = await getWalletBalance();
    return parseAvailableBalance(body);
  } catch (err) {
    logger.warn(`[MarzPay] balance read failed: ${err.message}`);
    return 0;
  }
}

export async function canCoverAmount(amount) {
  if (!amountInRange(amount)) return false;
  const available = await getAvailableUgx();
  return available >= Number(amount);
}

function payoutResult(body, uuid, phone) {
  const tx = body?.data?.transaction || {};
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

export async function sendPayout({
  countryCode,
  amount,
  currency,
  phone,
  recipientName,
  transactionId,
}) {
  const cfg = marzConfig();
  const uuid = marzPayReference();

  if (!amountInRange(amount)) {
    const err = new Error(
      `MarzPay amount ${amount} ${currency} is outside ${cfg.sendMoneyMinFiat}–${cfg.sendMoneyMaxFiat}`
    );
    err.code = 'MARZPAY_AMOUNT_OUT_OF_RANGE';
    throw err;
  }

  const body = await sendMoney({
    amount,
    phoneNumber: phone,
    country: countryCode,
    reference: uuid,
    description: recipientName
      ? `Rowan cash-out ${String(recipientName).slice(0, 80)}`
      : 'Rowan cash-out',
    callbackUrl: cfg.webhookUrl || undefined,
    metadata: [
      { orderId: String(transactionId || uuid) },
      { currency: String(currency || 'UGX') },
      { side: 'offramp' },
    ],
  });

  logger.info('[MarzPay] sendPayout accepted', {
    reference: uuid,
    providerUuid: body?.data?.transaction?.uuid,
    status: body?.data?.transaction?.status,
    mock: Boolean(body?._mock || marzPayIsMock()),
  });

  return payoutResult(body, uuid, phone);
}

export async function initiateCollection({
  countryCode,
  amount,
  currency,
  phone,
  transactionId,
}) {
  const cfg = marzConfig();
  const uuid = marzPayReference();

  if (!amountInRange(amount)) {
    const err = new Error(
      `MarzPay amount ${amount} ${currency} is outside ${cfg.sendMoneyMinFiat}–${cfg.sendMoneyMaxFiat}`
    );
    err.code = 'MARZPAY_AMOUNT_OUT_OF_RANGE';
    throw err;
  }

  const body = await collectMoney({
    amount,
    phoneNumber: phone,
    country: countryCode,
    reference: uuid,
    description: 'Rowan buy USDC',
    callbackUrl: cfg.webhookUrl || undefined,
    metadata: [
      { orderId: String(transactionId || uuid) },
      { currency: String(currency || 'UGX') },
      { side: 'onramp' },
    ],
  });

  logger.info('[MarzPay] initiateCollection accepted', {
    reference: uuid,
    providerUuid: body?.data?.transaction?.uuid,
    status: body?.data?.transaction?.status,
    mock: Boolean(body?._mock || marzPayIsMock()),
  });

  return payoutResult(body, uuid, phone);
}

export async function getPayoutStatus(referenceId) {
  return getSendMoney(referenceId);
}

export async function getCollectionStatus(referenceId) {
  return getCollectMoney(referenceId);
}

export function verifyWebhookSignature({ rawBody, timestamp, signatureHeader }) {
  return verifyMarzSignature({ rawBody, timestamp, signatureHeader });
}

export default {
  marzPayIsMock,
  getSettlementAddress,
  getFeeAddress,
  getInventorySecret,
  isAvailable,
  unavailableReason,
  amountInRange,
  getAvailableUgx,
  canCoverAmount,
  sendPayout,
  initiateCollection,
  getPayoutStatus,
  getCollectionStatus,
  verifyWebhookSignature,
};
