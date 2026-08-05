/**
 * Reloadly Top-ups API client (B2).
 * Mock mode when RELOADLY_CLIENT_ID is unset on testnet.
 */

import config from '../../config/index.js';
import redis from '../../db/redis.js';
import logger from '../../utils/logger.js';

const ACCEPT = 'application/com.reloadly.topups-v1+json';
const TOKEN_KEY = 'reloadly:access_token';

function isMock() {
  return config.reloadly.mockMode || !config.reloadly.clientId;
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
    const err = new Error(body?.message || body?.error || `Reloadly HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function getAccessToken() {
  if (isMock()) return 'mock-token';

  try {
    const cached = await redis.get(TOKEN_KEY);
    if (cached) return cached;
  } catch {
    /* redis optional */
  }

  const body = await fetchJson(config.reloadly.authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.reloadly.clientId,
      client_secret: config.reloadly.clientSecret,
      grant_type: 'client_credentials',
      audience: config.reloadly.audience,
    }),
  });

  const token = body.access_token;
  if (!token) throw new Error('Reloadly auth returned no access_token');

  try {
    await redis.set(TOKEN_KEY, token, 'EX', config.reloadly.tokenCacheSeconds);
  } catch {
    /* ignore */
  }

  return token;
}

async function reloadlyRequest(path, options = {}) {
  if (isMock()) {
    return mockResponse(path, options);
  }

  const token = await getAccessToken();
  return fetchJson(`${config.reloadly.baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: ACCEPT,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

function mockResponse(path, options) {
  if (path.includes('/accounts/balance')) {
    return { balance: 1000, currencyCode: 'USD', currencyName: 'US Dollar' };
  }
  if (path.includes('/operators/auto-detect')) {
    return {
      operatorId: 123,
      name: 'Mock Operator',
      country: { isoName: 'UG', name: 'Uganda' },
      denominationType: 'RANGE',
      supportsLocalAmounts: true,
      minAmount: 0.27,
      maxAmount: 27,
      localMinAmount: 1000,
      localMaxAmount: 100000,
      fx: { rate: 3750, currencyCode: 'UGX' },
      destinationCurrencyCode: 'UGX',
    };
  }
  if (path.match(/\/operators\/\d+$/)) {
    return {
      operatorId: 123,
      id: 123,
      name: 'MTN Uganda Data',
      data: true,
      bundle: true,
      denominationType: 'FIXED',
      supportsLocalAmounts: true,
      destinationCurrencyCode: 'UGX',
      localFixedAmounts: [1000, 2000, 3000, 5000, 10000],
      localFixedAmountsDescriptions: {
        '1000': '150MB — 24 hours',
        '2000': '350MB — 3 days',
        '3000': '500MB — 7 days',
        '5000': '1GB — 7 days',
        '10000': '2.5GB — 30 days',
      },
      country: { isoName: 'UG', name: 'Uganda' },
    };
  }
  if (path.includes('/operators/countries')) {
    return [
      { id: 123, name: 'MTN Uganda', country: { isoName: 'UG' } },
      { id: 124, name: 'Airtel Uganda', country: { isoName: 'UG' } },
    ];
  }
  if (path === '/topups' && options.method === 'POST') {
    const payload = JSON.parse(options.body || '{}');
    return {
      transactionId: `MOCK-${Date.now()}`,
      status: 'SUCCESSFUL',
      operatorTransactionId: `REF-${Math.floor(Math.random() * 1e6)}`,
      requestedAmount: payload.amount,
      deliveredAmount: payload.amount,
      discount: 0,
      customIdentifier: payload.customIdentifier,
    };
  }
  return {};
}

export async function getAccountBalance() {
  return reloadlyRequest('/accounts/balance');
}

export async function getOperatorsByCountry(isoCountryCode) {
  const code = String(isoCountryCode || 'UG').toUpperCase();
  return reloadlyRequest(`/operators/countries/${code}`);
}

export async function getOperatorById(operatorId) {
  const id = Number(operatorId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid operator id');
  }
  return reloadlyRequest(`/operators/${id}`, { method: 'GET' });
}

export async function autoDetectOperator(countryCode, phoneNumber) {
  const cc = String(countryCode || 'UG').toUpperCase();
  const number = String(phoneNumber || '').replace(/\D/g, '');
  return reloadlyRequest(
    `/operators/auto-detect/phone/${number}/countries/${cc}`,
    { method: 'GET' }
  );
}

export async function sendAirtimeTopup({
  operatorId,
  amount,
  countryCode,
  phoneNumber,
  customIdentifier,
}) {
  const cc = String(countryCode || 'UG').toUpperCase();
  const number = String(phoneNumber || '').replace(/\D/g, '');

  return reloadlyRequest('/topups', {
    method: 'POST',
    body: JSON.stringify({
      operatorId: Number(operatorId),
      amount: Number(amount),
      useLocalAmount: true,
      customIdentifier,
      recipientPhone: {
        countryCode: cc,
        number,
      },
    }),
  });
}

export function reloadlyIsMock() {
  return isMock();
}

export default {
  getAccessToken,
  getAccountBalance,
  getOperatorsByCountry,
  getOperatorById,
  autoDetectOperator,
  sendAirtimeTopup,
  reloadlyIsMock,
};
