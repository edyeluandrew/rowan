/**
 * MarzPay bills API — LIGHT/UMEME, NWSC, DSTV, GOTV.
 * Docs: https://wallet.wearemarz.com/documentation/bill-payments
 */

import crypto from 'crypto';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

const MOCK_AREAS = ['Kampala', 'Entebbe', 'Jinja', 'Mukono', 'Mbarara', 'Gulu', 'Masaka', 'Mbale', 'Fort Portal'];

const MOCK_DSTV_BOUQUETS = [
  { code: 'PREE36', name: 'Premium', price: '320000', period: 1, period_label: '1 Month' },
  { code: 'COMPE36', name: 'Compact', price: '120000', period: 1, period_label: '1 Month' },
  { code: 'COMP7DE36', name: 'DStv Compact 7D', price: '39000', period: 7, period_label: '7 Days' },
];

const MOCK_GOTV_BOUQUETS = [
  { code: 'GOTVMAX', name: 'GOtv Max', price: '45000', period: 1, period_label: '1 Month' },
  { code: 'GOTVSUPA', name: 'GOtv Supa', price: '25000', period: 1, period_label: '1 Month' },
];

function cfg() {
  return config.marzPay;
}

export function marzPayIsMock() {
  const c = cfg();
  return c.mockMode || !c.apiKey || !c.apiSecret;
}

export function marzPayBillFeeFiat() {
  return Number(cfg().billFeeFiat) || 1200;
}

function authHeader() {
  const { apiKey, apiSecret } = cfg();
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
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
    const err = new Error(body?.message || `MarzPay HTTP ${res.status}`);
    err.status = res.status >= 500 ? 502 : res.status === 401 || res.status === 403 ? 502 : 400;
    err.code = body?.error_code || body?.errorCode;
    err.body = body;
    err.httpStatus = res.status;
    throw err;
  }
  return body;
}

async function marzRequest(path, { method = 'GET', body } = {}) {
  if (marzPayIsMock()) {
    return mockResponse(path, method, body);
  }
  const url = `${cfg().baseUrl}${path}`;
  return fetchJson(url, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockResponse(path, method, body) {
  if (path === '/bill-payment/services' && method === 'GET') {
    return {
      status: 'success',
      data: {
        available_utilities: [
          {
            code: 'LIGHT',
            name: 'UMEME / LIGHT (Electricity)',
            description: 'Pay UMEME prepaid (Yaka) electricity',
            required_fields: ['meter_number', 'phone_number', 'amount'],
            optional_fields: ['customer_name', 'email'],
          },
          {
            code: 'NWSC',
            name: 'NWSC (Water)',
            description: 'Pay National Water and Sewerage Corporation',
            required_fields: ['meter_number', 'phone_number', 'amount', 'area'],
            optional_fields: ['customer_name', 'email'],
            area_options: MOCK_AREAS,
          },
          {
            code: 'DSTV',
            name: 'DSTV',
            description: 'Pay DStv subscription',
            required_fields: ['meter_number', 'phone_number', 'amount', 'bouquet_code'],
            optional_fields: ['customer_name', 'email'],
          },
          {
            code: 'GOTV',
            name: 'GOtv',
            description: 'Pay GOtv subscription',
            required_fields: ['meter_number', 'phone_number', 'amount', 'bouquet_code'],
            optional_fields: ['customer_name', 'email'],
          },
        ],
      },
    };
  }

  if (path === '/bill-payment/nwsc/areas') {
    return {
      status: 'success',
      data: { utility_code: 'NWSC', areas: MOCK_AREAS, count: MOCK_AREAS.length },
    };
  }

  if (path === '/bill-payment/dstv/bouquet-codes') {
    return {
      status: 'success',
      data: {
        utility_code: 'DSTV',
        bouquet_details: MOCK_DSTV_BOUQUETS,
        bouquet_codes: MOCK_DSTV_BOUQUETS.map((b) => b.code),
        count: MOCK_DSTV_BOUQUETS.length,
      },
    };
  }

  if (path === '/bill-payment/gotv/bouquet-codes') {
    return {
      status: 'success',
      data: {
        utility_code: 'GOTV',
        bouquet_details: MOCK_GOTV_BOUQUETS,
        bouquet_codes: MOCK_GOTV_BOUQUETS.map((b) => b.code),
        count: MOCK_GOTV_BOUQUETS.length,
      },
    };
  }

  if (path === '/bill-payment/verify' && method === 'POST') {
    const utility = String(body?.utility_code || 'LIGHT').toUpperCase();
    const meter = String(body?.meter_number || '');
    const isTv = utility === 'DSTV' || utility === 'GOTV';
    const bouquet = isTv
      ? (utility === 'GOTV' ? MOCK_GOTV_BOUQUETS[0] : MOCK_DSTV_BOUQUETS[0])
      : null;
    return {
      status: 'success',
      message: 'Meter/Account number verified successfully',
      data: {
        utility_code: utility,
        meter_number: meter,
        customer_details: {
          customer_ref: meter,
          customer_name: 'MOCK UMEME CUSTOMER',
          outstanding_balance: utility === 'NWSC' ? '15000.00' : '0.00',
          area: body?.area || 'Kampala',
          customer_type: utility === 'LIGHT' || utility === 'UMEME' ? 'PREPAID' : 'POSTPAID',
          ...(bouquet ? {
            smart_card_no: meter,
            bouquet_code: bouquet.code,
            bouquet_name: bouquet.name,
            bouquet_price: bouquet.price,
            utility_code: utility,
          } : {}),
        },
      },
      _mock: true,
    };
  }

  if (path === '/bill-payment' && method === 'POST') {
    const ref = body?.reference || crypto.randomUUID();
    const amount = Number(body?.amount) || 10000;
    const fee = marzPayBillFeeFiat();
    const utility = String(body?.utility_code || 'LIGHT').toUpperCase();
    const token = (utility === 'LIGHT' || utility === 'UMEME')
      ? '2737-6032-5315-7183-0856'
      : null;
    return {
      status: 'success',
      message: `${utility} bill payment successful!`,
      data: {
        transaction: {
          uuid: ref,
          reference: `BP${Date.now()}`,
          status: 'completed',
          provider_reference: `MOCK-${Date.now()}`,
        },
        bill_payment: {
          utility_code: utility,
          meter_number: body?.meter_number,
          customer_name: body?.customer_name || 'MOCK CUSTOMER',
          amount: { raw: amount, formatted: amount.toLocaleString(), currency: 'UGX' },
          charge: { raw: fee, formatted: fee.toLocaleString(), currency: 'UGX' },
          total_amount: { raw: amount + fee, currency: 'UGX' },
          token,
          yaka_token: token,
          units: token ? '12.5 kWh' : null,
        },
        timeline: {
          initiated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
      },
      _mock: true,
    };
  }

  if (path.startsWith('/bill-payment/') && method === 'GET') {
    return {
      status: 'success',
      data: {
        transaction: {
          uuid: path.split('/').pop(),
          status: 'completed',
          reference: `BP-MOCK`,
        },
      },
      _mock: true,
    };
  }

  return { status: 'success', data: {}, _mock: true };
}

export function normalizeUtilityCode(code) {
  const raw = String(code || '').trim().toUpperCase();
  if (raw === 'UMEME' || raw === 'YAKA' || raw === 'ELECTRICITY') return 'LIGHT';
  return raw;
}

export function formatMarzPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `256${digits.slice(1)}`;
  if (digits.startsWith('256') === false && digits.length === 9) digits = `256${digits}`;
  if (!digits.startsWith('256')) digits = `256${digits.replace(/^0/, '')}`;
  return `+${digits}`;
}

export async function listBillServices() {
  const body = await marzRequest('/bill-payment/services');
  return body?.data?.available_utilities || [];
}

export async function listNwscAreas() {
  const body = await marzRequest('/bill-payment/nwsc/areas');
  return body?.data?.areas || [];
}

export async function listBouquetCodes(utilityCode) {
  const code = normalizeUtilityCode(utilityCode).toLowerCase();
  const path = code === 'gotv'
    ? '/bill-payment/gotv/bouquet-codes'
    : '/bill-payment/dstv/bouquet-codes';
  const body = await marzRequest(path);
  return {
    utilityCode: body?.data?.utility_code || utilityCode,
    bouquets: body?.data?.bouquet_details || [],
    codes: body?.data?.bouquet_codes || [],
  };
}

export async function verifyBillAccount({
  utilityCode,
  meterNumber,
  area,
}) {
  const code = normalizeUtilityCode(utilityCode);
  const body = await marzRequest('/bill-payment/verify', {
    method: 'POST',
    body: {
      utility_code: code,
      meter_number: String(meterNumber).trim(),
      ...(code === 'NWSC' && area ? { area } : {}),
    },
  });
  const details = body?.data?.customer_details || {};
  return {
    provider: 'marzpay',
    mock: Boolean(body?._mock || marzPayIsMock()),
    utilityCode: body?.data?.utility_code || code,
    meterNumber: body?.data?.meter_number || meterNumber,
    customerName: details.customer_name || null,
    outstandingBalance: details.outstanding_balance != null
      ? Number(details.outstanding_balance)
      : null,
    area: details.area || area || null,
    customerType: details.customer_type || (code === 'LIGHT' ? 'PREPAID' : null),
    bouquetCode: details.bouquet_code || null,
    bouquetName: details.bouquet_name || null,
    bouquetPrice: details.bouquet_price != null ? Number(details.bouquet_price) : null,
    source: 'marzpay',
  };
}

export async function payBill({
  reference,
  utilityCode,
  meterNumber,
  phoneNumber,
  amount,
  area,
  bouquetCode,
  customerName,
  email,
}) {
  const code = normalizeUtilityCode(utilityCode);
  const payload = {
    reference,
    utility_code: code,
    meter_number: String(meterNumber).trim(),
    phone_number: formatMarzPhone(phoneNumber),
    amount: Number(amount),
    ...(customerName ? { customer_name: customerName } : {}),
    ...(email ? { email } : {}),
    ...(code === 'NWSC' ? { area } : {}),
    ...((code === 'DSTV' || code === 'GOTV') ? { bouquet_code: bouquetCode } : {}),
  };

  logger.info('[MarzPay] payBill', {
    reference,
    utilityCode: code,
    amount: payload.amount,
    mock: marzPayIsMock(),
  });

  return marzRequest('/bill-payment', { method: 'POST', body: payload });
}

export async function getBillPayment(reference) {
  return marzRequest(`/bill-payment/${encodeURIComponent(reference)}`);
}

export async function waitForBillSettlement(reference, { maxAttempts = 6, delayMs = 3000 } = {}) {
  let last = await getBillPayment(reference);
  for (let i = 0; i < maxAttempts; i += 1) {
    const status = String(
      last?.data?.transaction?.status || last?.status || ''
    ).toLowerCase();
    if (status === 'completed' || status === 'success' || status === 'successful') {
      return last;
    }
    if (status === 'failed') return last;
    await new Promise((r) => setTimeout(r, delayMs));
    last = await getBillPayment(reference);
  }
  return last;
}

export function servicesToBillers(services, { countryCode = 'UG', areas = [] } = {}) {
  return (services || []).map((svc) => {
    const code = normalizeUtilityCode(svc.code);
    const isElectricity = code === 'LIGHT';
    return {
      id: code,
      name: svc.name || code,
      countryCode,
      type: isElectricity ? 'ELECTRICITY_BILL_PAYMENT' : `${code}_BILL_PAYMENT`,
      serviceType: isElectricity ? 'PREPAID' : (code === 'NWSC' ? 'POSTPAID' : 'SUBSCRIPTION'),
      currency: 'UGX',
      minAmount: 1000,
      maxAmount: 2000000,
      provider: 'marzpay',
      requiredFields: svc.required_fields || [],
      areaOptions: svc.area_options || (code === 'NWSC' ? areas : []),
      description: svc.description || null,
    };
  });
}

export default {
  marzPayIsMock,
  marzPayBillFeeFiat,
  normalizeUtilityCode,
  formatMarzPhone,
  listBillServices,
  listNwscAreas,
  listBouquetCodes,
  verifyBillAccount,
  payBill,
  getBillPayment,
  waitForBillSettlement,
  servicesToBillers,
};
