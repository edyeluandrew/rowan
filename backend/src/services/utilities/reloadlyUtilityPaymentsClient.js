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
  const utilitiesMockExplicit = process.env.RELOADLY_UTILITIES_MOCK_MODE === 'true';
  return {
    mockMode: utilitiesMockExplicit || config.reloadly.mockMode,
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
    const code = body?.errorCode || body?.code;
    const detail = body?.message || body?.error || body?.errorMessage;
    const err = new Error(detail || `Reloadly utilities HTTP ${res.status}`);
    err.status = res.status >= 500 ? 502 : 400;
    err.code = code;
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

function buildMockBillPayResult(payload) {
  const mockId = Math.floor(Math.random() * 1e6);
  const amount = Number(payload.amount) || 10000;
  const units = Math.round((amount / 800) * 10) / 10;
  const account = String(payload.subscriberAccountNumber || '');
  const referenceId = payload.referenceId || `BILL-${Date.now()}`;
  const processing = {
    id: mockId,
    status: 'PROCESSING',
    referenceId,
    code: 'PAYMENT_PROCESSING_IN_PROGRESS',
    message: 'Mock bill payment processing',
    submittedAt: new Date().toISOString(),
  };
  const settled = {
    id: mockId,
    status: 'SUCCESSFUL',
    code: 'PAYMENT_PROCESSED_SUCCESSFULLY',
    message: 'Mock bill payment successful',
    transaction: {
      id: mockId,
      status: 'SUCCESSFUL',
      referenceId,
      billDetails: {
        type: 'ELECTRICITY_BILL_PAYMENT',
        serviceType: 'PREPAID',
        billerReferenceId: `MOCK-${mockId}`,
        subscriberDetails: {
          accountNumber: account,
          customerName: 'MOCK UMEME CUSTOMER',
        },
        pinDetails: {
          token: '2737-6032-5315-7183-0856',
          info1: `${units} kWh`,
        },
      },
    },
    _stagingFallback: true,
  };
  return { ...processing, _mockFinal: settled };
}

function isProviderUnavailableError(err) {
  const msg = String(err?.body?.message || err?.message || '');
  const code = String(err?.body?.errorCode || err?.code || '');
  if (/insufficient.?balance/i.test(msg) || code === 'INSUFFICIENT_BALANCE') return false;
  return /retrieve\/update resources/i.test(msg)
    || code === 'BILL_DETAILS_UNAVAILABLE'
    || code === 'QUERY_BILL_DETAILS_FAILED'
    || code === 'BILLER_NOT_SUPPORTED'
    || code === 'PAYMENT_PROCESSING_FAILED'
    || code === 'UNABLE_TO_PROCESS_REQUEST';
}

function stagingBillFallbackEnabled() {
  return (process.env.STELLAR_NETWORK || 'testnet') !== 'mainnet'
    && process.env.RELOADLY_UTILITIES_STAGING_FALLBACK !== 'false';
}

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
    return buildMockBillPayResult(payload);
  }
  if (path.startsWith('/accounts/validate') && options.method === 'POST') {
    const payload = JSON.parse(options.body || '{}');
    const amount = Number(payload.amount) || 0;
    const units = amount > 0 ? Math.round((amount / 800) * 10) / 10 : null;
    return {
      valid: true,
      customerName: 'MOCK UMEME CUSTOMER',
      accountNumber: String(payload.subscriberAccountNumber || ''),
      unitsDisplay: units != null ? `${units} kWh` : null,
      source: 'reloadly',
    };
  }
  if (path.startsWith('/transactions/') && options.method === 'GET') {
    const mockId = path.split('/').pop();
    const units = 12.5;
    return {
      code: 'PAYMENT_PROCESSED_SUCCESSFULLY',
      message: 'Mock bill payment successful',
      transaction: {
        id: Number(mockId) || 1,
        status: 'SUCCESSFUL',
        billDetails: {
          type: 'ELECTRICITY_BILL_PAYMENT',
          serviceType: 'PREPAID',
          billerReferenceId: `MOCK-${mockId}`,
          subscriberDetails: {
            accountNumber: '04123456789',
            customerName: 'MOCK UMEME CUSTOMER',
          },
          pinDetails: {
            token: '2737-6032-5315-7183-0856',
            info1: `${units} kWh`,
          },
        },
      },
    };
  }
  return {};
}

export async function lookupBillAccount({ billerId, subscriberAccountNumber, amount, useLocalAmount = true }) {
  if (isMock()) {
    const fiat = Number(amount) || 0;
    const units = fiat > 0 ? Math.round((fiat / 800) * 10) / 10 : null;
    return {
      valid: true,
      customerName: 'MOCK UMEME CUSTOMER',
      accountNumber: String(subscriberAccountNumber),
      unitsDisplay: units != null ? `${units} kWh` : null,
      source: 'reloadly',
      reloadlyMock: true,
    };
  }

  // Reloadly Utility Payments has no documented pre-payment account lookup.
  // Name and kWh are returned on GET /transactions/{id} after pay settles.
  return {
    valid: null,
    customerName: null,
    unitsDisplay: null,
    source: null,
    reloadlyMock: false,
    message: 'Reloadly confirms account name and electricity units after payment. They will appear on your receipt.',
  };
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

export async function getAccountBalance() {
  return utilitiesRequest('/accounts/balance', { method: 'GET' });
}

export async function payBillForPurchase(params) {
  const payload = {
    billerId: Number(params.billerId),
    subscriberAccountNumber: String(params.subscriberAccountNumber),
    amount: Number(params.amount),
    useLocalAmount: params.useLocalAmount !== false,
    referenceId: params.referenceId ? String(params.referenceId).slice(0, 40) : undefined,
  };

  if (isMock()) {
    const mock = buildMockBillPayResult(payload);
    return {
      result: mock._mockFinal || mock,
      usedStagingFallback: false,
      reloadlyMock: true,
    };
  }

  try {
    const initial = await payBill(params);
    const result = await waitForBillSettlement(initial, {
      maxAttempts: 10,
      delayMs: 3000,
    });
    return { result, usedStagingFallback: false, reloadlyMock: false };
  } catch (err) {
    if (!stagingBillFallbackEnabled() || !isProviderUnavailableError(err)) {
      throw err;
    }
    logger.warn('[ReloadlyUtilities] testnet staging fallback after provider error', {
      error: err.message,
      code: err.code,
      billerId: params.billerId,
    });
    const mock = buildMockBillPayResult(payload);
    return {
      result: mock._mockFinal || mock,
      usedStagingFallback: true,
      reloadlyMock: false,
      fallbackReason: err.message,
    };
  }
}

export async function payBill({
  billerId,
  subscriberAccountNumber,
  amount,
  useLocalAmount = true,
  referenceId,
  additionalInfo,
}) {
  const payload = {
    billerId: Number(billerId),
    subscriberAccountNumber: String(subscriberAccountNumber),
    amount: Number(amount),
    useLocalAmount,
    referenceId: referenceId ? String(referenceId).slice(0, 40) : undefined,
  };
  if (additionalInfo && Object.keys(additionalInfo).length) {
    payload.additionalInfo = additionalInfo;
  }
  return utilitiesRequest('/pay', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getTransaction(transactionId) {
  return utilitiesRequest(`/transactions/${transactionId}`, { method: 'GET' });
}

/** Poll Reloadly until SUCCESSFUL/FAILED or timeout (prepaid token + units). */
export async function waitForBillSettlement(initialResponse, { maxAttempts = 6, delayMs = 2000 } = {}) {
  if (isMock()) {
    return initialResponse._mockFinal || initialResponse;
  }

  let latest = initialResponse;
  const txId = initialResponse?.id;
  if (!txId) return latest;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = String(
      latest?.transaction?.status || latest?.status || ''
    ).toUpperCase();
    const hasPin = latest?.transaction?.billDetails?.pinDetails
      || latest?.billDetails?.pinDetails;
    if (status === 'SUCCESSFUL' || status === 'FAILED' || hasPin) break;
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      latest = await getTransaction(txId);
    } catch (err) {
      logger.warn('[ReloadlyUtilities] transaction poll failed', { txId, error: err.message });
      break;
    }
  }
  return latest;
}

export function reloadlyUtilitiesIsMock() {
  return isMock();
}

export default {
  getBillers,
  lookupBillAccount,
  getAccountBalance,
  payBill,
  payBillForPurchase,
  getTransaction,
  waitForBillSettlement,
  reloadlyUtilitiesIsMock,
};
