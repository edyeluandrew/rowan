/**
 * Yellow Card / Yellow Pay aggregator client (C1).
 * Sandbox + mock mode when credentials are absent — safe for testnet development.
 *
 * API docs: https://developers.yellowcard.engineering (verify against live portal).
 */

import config from '../../../config/index.js';
import logger from '../../../utils/logger.js';

function yellowConfig() {
  const yc = config.yellowPay || {};
  return {
    clientId: yc.clientId,
    clientSecret: yc.clientSecret,
    apiKey: yc.apiKey,
    baseUrl: yc.baseUrl,
    webhookSecret: yc.webhookSecret,
    mockMode: yc.mockMode,
    enabled: yc.enabled,
    sandboxCorridors: yc.sandboxCorridors || [],
  };
}

function isConfigured() {
  const cfg = yellowConfig();
  return Boolean(cfg.clientId && cfg.clientSecret) || Boolean(cfg.apiKey);
}

function corridorEnabled(countryCode) {
  const cfg = yellowConfig();
  if (!cfg.enabled) return false;
  if (cfg.mockMode || !isConfigured()) {
    return cfg.sandboxCorridors.includes(String(countryCode || '').toUpperCase());
  }
  return cfg.sandboxCorridors.includes(String(countryCode || '').toUpperCase());
}

export function yellowPayIsMock() {
  const cfg = yellowConfig();
  return cfg.mockMode || !isConfigured();
}

export function isAvailable(countryCode, _side = 'offramp') {
  return corridorEnabled(countryCode);
}

export function unavailableReason(countryCode, side) {
  const cfg = yellowConfig();
  if (!cfg.enabled) return 'Yellow Pay disabled in config';
  const code = String(countryCode || '').toUpperCase();
  if (!cfg.sandboxCorridors.includes(code)) {
    return `Corridor ${code} not enabled for Yellow Pay yet`;
  }
  if (!isConfigured()) return 'Yellow Pay credentials not configured (mock mode available on testnet)';
  return `Yellow Pay unavailable for ${side} in ${code}`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(body?.message || body?.error || `Yellow Pay HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/**
 * Send fiat payout (offramp) via Yellow Pay.
 * @returns {Promise<{ referenceId: string, status: string, provider: string, mock: boolean }>}
 */
export async function sendPayout({
  countryCode,
  amount,
  currency,
  phone,
  reference,
  recipientName,
}) {
  const cfg = yellowConfig();
  const mock = yellowPayIsMock();

  if (mock) {
    const ref = reference || `YC-MOCK-${Date.now()}`;
    logger.info('[YellowPay] mock sendPayout', { countryCode, amount, currency, phone: phone?.slice(-4), ref });
    return {
      referenceId: ref,
      status: 'PROCESSING',
      provider: 'yellow_pay',
      mock: true,
    };
  }

  const payload = {
    country: String(countryCode).toUpperCase(),
    amount: Number(amount),
    currency: String(currency).toUpperCase(),
    phone: String(phone),
    reference,
    recipientName: recipientName || undefined,
  };

  const body = await fetchJson(`${cfg.baseUrl}/payouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey || cfg.clientId}`,
    },
    body: JSON.stringify(payload),
  });

  return {
    referenceId: body.referenceId || body.id || reference,
    status: body.status || 'PROCESSING',
    provider: 'yellow_pay',
    mock: false,
    raw: body,
  };
}

/**
 * Initiate fiat collection (onramp) — user pays MoMo, Rowan receives settlement signal via webhook.
 */
export async function initiateDeposit({
  countryCode,
  amount,
  currency,
  phone,
  reference,
}) {
  const mock = yellowPayIsMock();

  if (mock) {
    const ref = reference || `YC-DEP-MOCK-${Date.now()}`;
    logger.info('[YellowPay] mock initiateDeposit', { countryCode, amount, currency, ref });
    return {
      referenceId: ref,
      status: 'PENDING',
      provider: 'yellow_pay',
      mock: true,
      paymentInstructions: 'Mock: pay via MoMo — webhook will confirm in sandbox.',
    };
  }

  const cfg = yellowConfig();
  const body = await fetchJson(`${cfg.baseUrl}/collections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey || cfg.clientId}`,
    },
    body: JSON.stringify({
      country: String(countryCode).toUpperCase(),
      amount: Number(amount),
      currency: String(currency).toUpperCase(),
      phone: String(phone),
      reference,
    }),
  });

  return {
    referenceId: body.referenceId || body.id || reference,
    status: body.status || 'PENDING',
    provider: 'yellow_pay',
    mock: false,
    paymentInstructions: body.instructions || null,
    raw: body,
  };
}

export async function getPayoutStatus(referenceId) {
  if (yellowPayIsMock()) {
    return { referenceId, status: 'COMPLETED', provider: 'yellow_pay', mock: true };
  }
  const cfg = yellowConfig();
  return fetchJson(`${cfg.baseUrl}/payouts/${encodeURIComponent(referenceId)}`, {
    headers: { Authorization: `Bearer ${cfg.apiKey || cfg.clientId}` },
  });
}

export function verifyWebhookSignature(_payload, _signature) {
  const cfg = yellowConfig();
  if (yellowPayIsMock() || !cfg.webhookSecret) return true;
  // TODO: implement HMAC verification when Yellow Pay webhook spec is confirmed
  return false;
}

export default {
  yellowPayIsMock,
  isAvailable,
  unavailableReason,
  sendPayout,
  initiateDeposit,
  getPayoutStatus,
  verifyWebhookSignature,
};
