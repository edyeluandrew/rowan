/**
 * Reloadly Utility Payments API (B4 — electricity, water, TV bills).
 * Separate product from Top-ups — different audience, base URL, and token cache.
 */

import config from '../../config/index.js';
import redis from '../../db/redis.js';
import logger from '../../utils/logger.js';

const ACCEPT = 'application/com.reloadly.utilities-v1+json';
const TOKEN_KEY = 'reloadly:utilities:access_token';

function utilitiesConfig() {
  const isMainnet = (process.env.STELLAR_NETWORK || 'testnet') === 'mainnet';
  return {
    mockMode: config.reloadly.mockMode,
    clientId: config.reloadly.clientId,
    clientSecret: config.reloadly.clientSecret,
    authUrl: config.reloadly.authUrl,
    audience: process.env.RELOADLY_UTILITIES_AUDIENCE
      || (isMainnet ? 'https://utilities.reloadly.com' : 'https://utilities-sandbox.reloadly.com'),
    baseUrl: process.env.RELOADLY_UTILITIES_BASE_URL
      || (isMainnet ? 'https://utilities.reloadly.com' : 'https://utilities-sandbox.reloadly.com'),
    tokenCacheSeconds: config.reloadly.tokenCacheSeconds,
  };
}

function isMock() {
  const cfg = utilitiesConfig();
  return cfg.mockMode || !cfg.clientId;
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
    const err = new Error(body?.message || body?.error || `Reloadly utilities HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function getAccessToken() {
  if (isMock()) return 'mock-utilities-token';

  const cfg = utilitiesConfig();
  try {
    const cached = await redis.get(TOKEN_KEY);
    if (cached) return cached;
  } catch {
    /* redis optional */
  }

  const body = await fetchJson(cfg.authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'client_credentials',
      audience: cfg.audience,
    }),
  });

  const token = body.access_token;
  if (!token) throw new Error('Reloadly utilities auth returned no access_token');

  try {
    await redis.set(TOKEN_KEY, token, 'EX', cfg.tokenCacheSeconds);
  } catch {
    /* ignore */
  }

  return token;
}

async function utilitiesRequest(path, options = {}) {
  if (isMock()) {
    return mockResponse(path, options);
  }

  const cfg = utilitiesConfig();
  const token = await getAccessToken();
  return fetchJson(`${cfg.baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: ACCEPT,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

const MOCK_BILLERS = [
  {
    id: 501,
    name: 'Uganda Umeme Postpaid',
    countryIsoCode: 'UG',
    type: 'ELECTRICITY_BILL_PAYMENT',
    serviceType: 'POSTPAID',
    localAmountSupported: true,
    localTransactionCurrencyCode: 'UGX',
    minLocalTransactionAmount: 1000,
    maxLocalTransactionAmount: 5000000,
  },
  {
    id: 502,
    name: 'Uganda Umeme Prepaid',
    countryIsoCode: 'UG',
    type: 'ELECTRICITY_BILL_PAYMENT',
    serviceType: 'PREPAID',
    localAmountSupported: true,
    localTransactionCurrencyCode: 'UGX',
    minLocalTransactionAmount: 1000,
    maxLocalTransactionAmount: 500000,
  },
  {
    id: 601,
    name: 'Kenya Electricity Prepaid',
    countryIsoCode: 'KE',
    type: 'ELECTRICITY_BILL_PAYMENT',
    serviceType: 'PREPAID',
    localAmountSupported: true,
    localTransactionCurrencyCode: 'KES',
    minLocalTransactionAmount: 100,
    maxLocalTransactionAmount: 50000,
  },
  {
    id: 602,
    name: 'Kenya Electricity Postpaid',
    countryIsoCode: 'KE',
    type: 'ELECTRICITY_BILL_PAYMENT',
    serviceType: 'POSTPAID',
    localAmountSupported: true,
    localTransactionCurrencyCode: 'KES',
    minLocalTransactionAmount: 100,
    maxLocalTransactionAmount: 100000,
  },
];

function mockResponse(path, options) {
  if (path.includes('/accounts/balance')) {
    return { balance: 500, currencyCode: 'USD', currencyName: 'US Dollar' };
  }
  if (path.startsWith('/billers')) {
    const url = new URL(`http://x${path}`);
    const country = url.searchParams.get('countryISOCode')?.toUpperCase();
    let content = MOCK_BILLERS;
    if (country) {
      content = MOCK_BILLERS.filter((b) => b.countryIsoCode === country);
    }
    return { content, totalElements: content.length, totalPages: 1 };
  }
  if (path === '/pay' && options.method === 'POST') {
    const payload = JSON.parse(options.body || '{}');
    return {
      id: Math.floor(Math.random() * 1e6),
      status: 'SUCCESSFUL',
      referenceId: payload.referenceId || `BILL-${Date.now()}`,
      code: 'PAYMENT_SUCCESSFUL',
      message: 'Mock bill payment successful',
      submittedAt: new Date().toISOString(),
    };
  }
  return {};
}

export async function getBillers({ countryISOCode, type, serviceType, page = 1, size = 200 } = {}) {
  const params = new URLSearchParams();
  if (countryISOCode) params.set('countryISOCode', String(countryISOCode).toUpperCase());
  if (type) params.set('type', type);
  if (serviceType) params.set('serviceType', serviceType);
  params.set('page', String(page));
  params.set('size', String(size));
  const qs = params.toString();
  return utilitiesRequest(`/billers${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function payBill({
  billerId,
  subscriberAccountNumber,
  amount,
  useLocalAmount = true,
  referenceId,
}) {
  return utilitiesRequest('/pay', {
    method: 'POST',
    body: JSON.stringify({
      billerId: Number(billerId),
      subscriberAccountNumber: String(subscriberAccountNumber),
      amount: Number(amount),
      useLocalAmount,
      referenceId,
    }),
  });
}

export function reloadlyUtilitiesIsMock() {
  return isMock();
}

export default {
  getBillers,
  payBill,
  reloadlyUtilitiesIsMock,
};
