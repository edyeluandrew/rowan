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
    const idMatch = path.match(/\/operators\/(\d+)$/);
    const id = Number(idMatch?.[1] || 123);
    const isData = [1151, 1152, 1171, 1172, 342, 281].includes(id);
    return {
      operatorId: id,
      id,
      name: isData ? `Mock Data Operator ${id}` : `Mock Airtime Operator ${id}`,
      data: isData && ![1171, 1172].includes(id),
      bundle: [1171, 1172].includes(id),
      denominationType: isData ? 'FIXED' : 'RANGE',
      supportsLocalAmounts: true,
      destinationCurrencyCode: 'UGX',
      minAmount: 0.27,
      maxAmount: 27,
      localMinAmount: 1000,
      localMaxAmount: 100000,
      localFixedAmounts: isData ? [1000, 2000, 3000, 5000, 10000] : undefined,
      localFixedAmountsDescriptions: isData
        ? {
            '1000': '150MB — 24 hours',
            '2000': '350MB — 3 days',
            '3000': '500MB — 7 days',
            '5000': '1GB — 7 days',
            '10000': '2.5GB — 30 days',
          }
        : undefined,
      fx: { rate: 3750, currencyCode: 'UGX' },
      country: { isoName: 'UG', name: 'Uganda' },
    };
  }
  if (path.includes('/operators/countries')) {
    const iso = (path.match(/\/operators\/countries\/([A-Z]{2})/i) || [])[1] || 'UG';
    const code = String(iso).toUpperCase();
    // Include data/bundle flags — getDataAvailability filters on these.
    // (Plain airtime rows alone made UG appear "unavailable" in mock.)
    if (code === 'UG') {
      return [
        { id: 515, operatorId: 515, name: 'MTN Uganda', data: false, bundle: false, denominationType: 'RANGE', supportsLocalAmounts: true, destinationCurrencyCode: 'UGX', country: { isoName: 'UG' } },
        { id: 1151, operatorId: 1151, name: 'MTN Uganda Data', data: true, bundle: false, denominationType: 'FIXED', supportsLocalAmounts: true, destinationCurrencyCode: 'UGX', localFixedAmounts: [1000, 2000, 5000, 10000], localFixedAmountsDescriptions: { '1000': '150MB — 24h', '2000': '350MB', '5000': '1GB', '10000': '2.5GB' }, country: { isoName: 'UG' } },
        { id: 1171, operatorId: 1171, name: 'MTN Uganda Bundles', data: false, bundle: true, denominationType: 'FIXED', supportsLocalAmounts: true, destinationCurrencyCode: 'UGX', localFixedAmounts: [1000, 3000, 5000], localFixedAmountsDescriptions: { '1000': 'Daily pack', '3000': 'Weekly', '5000': 'Monthly' }, country: { isoName: 'UG' } },
        { id: 516, operatorId: 516, name: 'Airtel Uganda', data: false, bundle: false, denominationType: 'RANGE', supportsLocalAmounts: true, destinationCurrencyCode: 'UGX', country: { isoName: 'UG' } },
        { id: 1152, operatorId: 1152, name: 'Airtel Uganda Data', data: true, bundle: false, denominationType: 'FIXED', supportsLocalAmounts: true, destinationCurrencyCode: 'UGX', localFixedAmounts: [1000, 2000, 5000, 10000], localFixedAmountsDescriptions: { '1000': '100MB', '2000': '250MB', '5000': '1GB', '10000': '2GB' }, country: { isoName: 'UG' } },
        { id: 1172, operatorId: 1172, name: 'Airtel Uganda Bundles', data: false, bundle: true, denominationType: 'FIXED', supportsLocalAmounts: true, destinationCurrencyCode: 'UGX', localFixedAmounts: [1000, 2500, 5000], localFixedAmountsDescriptions: { '1000': 'Daily', '2500': 'Weekly', '5000': 'Monthly' }, country: { isoName: 'UG' } },
      ];
    }
    if (code === 'NG') {
      return [
        { id: 341, operatorId: 341, name: 'MTN Nigeria', data: false, bundle: false, country: { isoName: 'NG' } },
        { id: 342, operatorId: 342, name: 'MTN Nigeria Data', data: true, bundle: false, denominationType: 'FIXED', supportsLocalAmounts: true, destinationCurrencyCode: 'NGN', localFixedAmounts: [100, 200, 500], localFixedAmountsDescriptions: { '100': '100MB', '200': '200MB', '500': '1GB' }, country: { isoName: 'NG' } },
      ];
    }
    if (code === 'GH') {
      return [
        { id: 280, operatorId: 280, name: 'MTN Ghana', data: false, bundle: false, country: { isoName: 'GH' } },
        { id: 281, operatorId: 281, name: 'MTN Ghana Data', data: true, bundle: false, denominationType: 'FIXED', supportsLocalAmounts: true, destinationCurrencyCode: 'GHS', localFixedAmounts: [1, 5, 10], localFixedAmountsDescriptions: { '1': '100MB', '5': '1GB', '10': '3GB' }, country: { isoName: 'GH' } },
      ];
    }
    // KE/TZ/RW sandbox often has zero data products — keep empty so UI can message correctly
    return [];
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
