/**
 * Kotani Pay aggregator client — Stellar-native MoMo on/off-ramp.
 * Sandbox: https://sandbox-api.kotanipay.io/api/v3
 * Docs: https://docs.kotanipay.com/reference/endpoints-1
 */

import crypto from 'crypto';
import config from '../../../config/index.js';
import logger from '../../../utils/logger.js';

const ROWAN_NETWORK_TO_KOTANI = {
  MTN_UG: 'MTN',
  AIRTEL_UG: 'AIRTEL',
  MPESA: 'MPESA',
  MPESA_KE: 'MPESA',
  MTN_RW: 'MTN',
  AIRTEL_RW: 'AIRTEL',
  MTN_TZ: 'MTN',
  AIRTEL_TZ: 'AIRTEL',
  TIGO_TZ: 'TIGO',
  MTN_GH: 'MTN',
  AIRTELTIGO_GH: 'AIRTEL',
  VODAFONE_GH: 'VODAFONE',
  MTN_NG: 'MTN',
  AIRTEL_NG: 'AIRTEL',
};

function kotaniConfig() {
  const k = config.kotaniPay || {};
  return {
    enabled: k.enabled,
    mockMode: k.mockMode,
    baseUrl: k.baseUrl,
    jwt: k.jwt,
    apiKey: k.apiKey,
    callbackUrl: k.callbackUrl,
    senderStellarAddress: k.senderStellarAddress,
    webhookSecret: k.webhookSecret,
    sandboxCorridors: k.sandboxCorridors || [],
  };
}

export function isConfigured() {
  const cfg = kotaniConfig();
  return Boolean(cfg.jwt || cfg.apiKey);
}

export function kotaniPayIsMock() {
  const cfg = kotaniConfig();
  return cfg.mockMode || !isConfigured();
}

function corridorEnabled(countryCode) {
  const cfg = kotaniConfig();
  if (!cfg.enabled) return false;
  return cfg.sandboxCorridors.includes(String(countryCode || '').toUpperCase());
}

export function isAvailable(countryCode, _side = 'offramp') {
  return corridorEnabled(countryCode);
}

export function unavailableReason(countryCode, side) {
  const cfg = kotaniConfig();
  if (!cfg.enabled) return 'Kotani Pay disabled in config';
  const code = String(countryCode || '').toUpperCase();
  if (!cfg.sandboxCorridors.includes(code)) {
    return `Corridor ${code} not enabled for Kotani Pay yet`;
  }
  if (!isConfigured()) return 'Kotani Pay JWT/API key not configured';
  return `Kotani Pay unavailable for ${side} in ${code}`;
}

export function mapNetworkToKotaniProvider(networkCode) {
  const code = String(networkCode || '').trim().toUpperCase();
  return ROWAN_NETWORK_TO_KOTANI[code] || null;
}

function authHeaders() {
  const cfg = kotaniConfig();
  const token = cfg.jwt || cfg.apiKey;
  if (!token) {
    throw new Error('Kotani Pay auth token missing (KOTANI_PAY_JWT or KOTANI_PAY_API_KEY)');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function fetchJson(path, options = {}) {
  const cfg = kotaniConfig();
  const base = cfg.baseUrl.replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(body?.message || body?.error || `Kotani Pay HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function unwrapData(body) {
  if (body && typeof body === 'object' && body.data != null) return body.data;
  return body;
}

/**
 * Create offramp — Kotani returns escrowAddress; Rowan sends USDC there next.
 */
export async function sendPayout({
  countryCode,
  network,
  amount,
  currency,
  phone,
  reference,
  recipientName,
  cryptoAmount,
  senderAddress,
}) {
  const mock = kotaniPayIsMock();
  const networkProvider = mapNetworkToKotaniProvider(network);

  if (mock) {
    const ref = reference || `KP-MOCK-${Date.now()}`;
    logger.info('[KotaniPay] mock sendPayout', {
      countryCode,
      amount,
      currency,
      phone: phone?.slice(-4),
      ref,
    });
    return {
      referenceId: ref,
      status: 'PROCESSING',
      provider: 'kotani_pay',
      mock: true,
      escrowAddress: null,
    };
  }

  if (!networkProvider) {
    throw new Error(`Unsupported network for Kotani Pay: ${network}`);
  }

  const cfg = kotaniConfig();
  const payload = {
    mobileMoneyReceiver: {
      phoneNumber: String(phone),
      accountName: recipientName || 'Rowan User',
      networkProvider,
    },
    cryptoAmount: Number(cryptoAmount ?? amount),
    currency: String(currency).toUpperCase(),
    chain: 'STELLAR',
    token: 'USDC',
    referenceId: reference,
    senderAddress: senderAddress || cfg.senderStellarAddress || undefined,
    callbackUrl: cfg.callbackUrl || undefined,
  };

  const body = await fetchJson('/api/v3/offramp', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = unwrapData(body);
  return {
    referenceId: data.referenceId || data.reference_id || reference,
    status: data.status || 'PROCESSING',
    provider: 'kotani_pay',
    mock: false,
    escrowAddress: data.escrowAddress || data.escrow_address || null,
    onchainStatus: data.onchainStatus || data.onchain_status || null,
    raw: data,
  };
}

export async function getPayoutStatus(referenceId) {
  if (kotaniPayIsMock()) {
    return { referenceId, status: 'COMPLETED', provider: 'kotani_pay', mock: true };
  }
  const body = await fetchJson(`/api/v3/offramp/${encodeURIComponent(referenceId)}`, {
    headers: authHeaders(),
  });
  return unwrapData(body);
}

export async function initiateDeposit(_params) {
  // Onramp wiring follows in a later slice (onramp/crypto + deposit/mobile-money).
  throw new Error('Kotani onramp not wired yet — use P2P buy flow for now');
}

/**
 * Kotani signed webhooks: HMAC-SHA256 over JSON.stringify({ event, data }).
 * @see https://documentation.kotanipay.com/v3/essentials/webhooks
 */
export function verifyWebhookSignature(payload, headerSignature) {
  const cfg = kotaniConfig();
  if (kotaniPayIsMock() || !cfg.webhookSecret) return true;

  const signature = String(headerSignature || '').trim();
  if (!signature) return false;
  if (!payload || typeof payload !== 'object') return false;

  // Signed envelope mode (webhook secret configured in Kotani portal).
  if (payload.event && payload.data) {
    const { signature: _bodySignature, ...payloadWithoutSignature } = payload;
    const computed = `sha256=${crypto
      .createHmac('sha256', cfg.webhookSecret)
      .update(JSON.stringify(payloadWithoutSignature))
      .digest('hex')}`;

    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  }

  // Direct callbackUrl posts have no signature headers when no webhook secret is set.
  return false;
}

/** Normalize signed envelope vs legacy direct callback body. */
export function normalizeWebhookPayload(body) {
  const event = body || {};
  if (event.event && event.data) {
    return {
      signed: true,
      eventType: event.event,
      payload: event.data,
    };
  }
  return {
    signed: false,
    eventType: event.event || event.type || 'callback',
    payload: event,
  };
}

export default {
  kotaniPayIsMock,
  isConfigured,
  isAvailable,
  unavailableReason,
  mapNetworkToKotaniProvider,
  sendPayout,
  getPayoutStatus,
  initiateDeposit,
  verifyWebhookSignature,
  normalizeWebhookPayload,
};
