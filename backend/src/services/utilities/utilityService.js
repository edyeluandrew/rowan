/**
 * Utility purchase orchestration (B2 + B6).
 */

import crypto from 'crypto';
import db from '../../db/index.js';
import config from '../../config/index.js';
import countryService from '../countries/countryService.js';
import marzPayClient from './marzPayClient.js';
import { extractBillDelivery } from './utilityElectricity.js';
import utilityPricing from './utilityPricing.js';
import utilityUsdcService from './utilityUsdcService.js';
import logger from '../../utils/logger.js';

const { assertFiatAmountAllowed } = utilityPricing;

function buildMemo() {
  const short = crypto.randomBytes(4).toString('hex');
  return `ROWAN-UT-${short}`;
}

function normalizePhone(phone, countryCode) {
  let digits = String(phone || '').replace(/\D/g, '');
  const country = countryService.getCountry(countryCode);
  const prefix = (country?.phonePrefix || '+256').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = prefix.slice(1) + digits.slice(1);
  if (!digits.startsWith(prefix.replace(/^\+/, ''))) {
    digits = prefix.replace(/^\+/, '') + digits;
  }
  return digits;
}

function normalizeSubscriberAccount(account) {
  return String(account || '').trim().replace(/\s+/g, '');
}

function friendlyBillPayError(err) {
  const msg = err?.body?.message || err?.message || 'Bill payment failed';
  const code = err?.body?.error_code || err?.body?.errorCode || err?.code;
  if (/insufficient.?balance/i.test(msg) || code === 'INSUFFICIENT_BALANCE') {
    return 'Bill-pay wallet balance is too low. Fund the MarzPay UGX wallet, then retry.';
  }
  if (code === 'SERVICE_NOT_SUBSCRIBED') {
    return 'Bill Payments is not enabled on the MarzPay account. Subscribe in the MarzPay marketplace.';
  }
  if (code === 'AMOUNT_MISMATCH') {
    return msg;
  }
  if (code === 'VERIFICATION_FAILED' || code === 'INVALID_SUBSCRIBER_ACCOUNT_NUMBER') {
    return 'Could not verify this meter or account number. Check the number and try again.';
  }
  if (code === 'DUPLICATE_REFERENCE' || code === 'INVALID_REFERENCE_FORMAT') {
    return 'Payment reference error. Get a new quote and try once.';
  }
  if (/retrieve\/update resources/i.test(msg)) {
    return 'The utility provider is temporarily unavailable. If USDC was already sent, save your memo and contact support.';
  }
  if (code === 'BILLER_NOT_SUPPORTED' || code === 'BILLER_NOT_FOUND') {
    return 'This bill provider is not available right now. Try another provider or contact support.';
  }
  if (/ip whitelist/i.test(msg)) {
    return 'MarzPay blocked this server IP. After they whitelist Render outbound IPs, tap Retry — do not send USDC again.';
  }
  return msg;
}

function readReceipt(row) {
  if (!row?.receipt) return {};
  try {
    return typeof row.receipt === 'string' ? JSON.parse(row.receipt) : row.receipt;
  } catch {
    return {};
  }
}

function billsViaMarzPay() {
  return config.marzPay.enabled !== false;
}

function airtimeViaMarzPay(countryCode = 'UG') {
  return config.marzPay.enabled !== false && String(countryCode || 'UG').toUpperCase() === 'UG';
}

function marzNetworkToRowan(detected) {
  const code = String(detected || '').toUpperCase();
  if (code === 'AIRTEL') return 'AIRTEL_UG';
  if (code === 'LYCA') return 'LYCA_UG';
  return 'MTN_UG';
}

async function insertUtilityQuote({
  userId,
  utilityType,
  code,
  networkCode,
  operatorId,
  operatorName,
  recipientValue,
  pricing,
  bundleLabel,
  provider = 'marzpay',
  receipt = {},
}) {
  const memo = buildMemo();
  const expiresAt = new Date(Date.now() + config.utilities.quoteTtlSeconds * 1000);
  const treasuryPublicKey = utilityUsdcService.getUtilityTreasuryPublicKey();

  const result = await db.query(
    `INSERT INTO utility_purchases
       (user_id, utility_type, country_code, network_code, operator_id, operator_name,
        recipient_phone, fiat_amount, fiat_currency, usdc_amount, platform_fee_usdc,
        fx_rate, status, memo, expires_at, bundle_description, provider, receipt)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'QUOTED', $13, $14, $15, $16, $17::jsonb)
     RETURNING *`,
    [
      userId,
      utilityType,
      code,
      networkCode,
      operatorId ? String(operatorId) : null,
      operatorName,
      recipientValue,
      pricing.billFiatAmount ?? pricing.fiatAmount,
      pricing.fiatCurrency,
      pricing.totalUsdc,
      pricing.platformFeeUsdc,
      pricing.fxRate,
      memo,
      expiresAt,
      bundleLabel,
      provider,
      JSON.stringify(receipt || {}),
    ]
  );

  const providerMock = marzPayClient.marzPayIsMock();

  return formatPurchase(result.rows[0], {
    treasuryPublicKey,
    pricing,
    reloadlyMock: providerMock,
    marzPayMock: providerMock,
  });
}

export async function listProviders(countryCode, type = 'airtime') {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  if (!countryService.isActiveCountry(code)) {
    const err = new Error(`Unsupported country: ${code}`);
    err.status = 400;
    throw err;
  }

  const methods = countryService.getPaymentMethods(code);
  return methods.map((m) => ({
    countryCode: code,
    networkCode: m.networkCode,
    label: m.label,
    type,
    provider: m.provider,
  }));
}

export async function listOperators(countryCode) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  if (code !== 'UG') {
    const err = new Error('Utilities are available in Uganda first');
    err.status = 400;
    throw err;
  }
  return [
    { operatorId: 'MTN', operatorName: 'MTN Uganda', networkCode: 'MTN_UG', countryCode: 'UG' },
    { operatorId: 'AIRTEL', operatorName: 'Airtel Uganda', networkCode: 'AIRTEL_UG', countryCode: 'UG' },
  ];
}

export async function getDataAvailability(countryCode) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  if (!countryService.isActiveCountry(code)) {
    const err = new Error(`Unsupported country: ${code}`);
    err.status = 400;
    throw err;
  }
  if (code !== 'UG' || !airtimeViaMarzPay(code)) {
    const err = new Error('Airtime and data are available in Uganda first');
    err.status = 400;
    throw err;
  }
  return {
    countryCode: code,
    available: true,
    operators: ['MTN Uganda', 'Airtel Uganda'],
    provider: 'marzpay',
    reloadlyMock: marzPayClient.marzPayIsMock(),
    marzPayMock: marzPayClient.marzPayIsMock(),
  };
}

export async function getTopupLimits({
  countryCode,
  networkCode,
  recipientPhone,
  utilityType = 'airtime',
}) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  const network = String(networkCode || '').trim().toUpperCase();
  const phone = normalizePhone(recipientPhone, code);

  if (!countryService.isActiveCountry(code)) {
    const err = new Error(`Unsupported country: ${code}`);
    err.status = 400;
    throw err;
  }
  if (!phone || phone.length < 9) {
    const err = new Error('Valid recipient phone is required');
    err.status = 400;
    throw err;
  }
  if (!airtimeViaMarzPay(code)) {
    const err = new Error('Airtime and data are available in Uganda first');
    err.status = 400;
    throw err;
  }
  const limits = await marzPayClient.getAirtimeLimits({ msisdn: phone, networkCode: network });
  return {
    ...limits,
    networkCode: marzNetworkToRowan(limits.detectedNetwork),
  };
}

export async function listDataBundles({ countryCode, networkCode, recipientPhone }) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  if (!airtimeViaMarzPay(code)) {
    const err = new Error('Airtime and data are available in Uganda first');
    err.status = 400;
    throw err;
  }
  const catalog = await marzPayClient.listAirtimeBundles({
    msisdn: normalizePhone(recipientPhone, code),
    networkCode,
  });
  return {
    operatorId: catalog.operatorId,
    operatorName: catalog.operatorName,
    denominationType: 'FIXED',
    fiatCurrency: catalog.fiatCurrency,
    bundles: catalog.bundles,
    countryCode: code,
    networkCode,
    recipientPhone: catalog.recipientPhone,
    provider: 'marzpay',
    reloadlyMock: catalog.marzPayMock,
    marzPayMock: catalog.marzPayMock,
    message: catalog.message || null,
  };
}

export async function listBillers(countryCode) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  if (!countryService.isActiveCountry(code)) {
    const err = new Error(`Unsupported country: ${code}`);
    err.status = 400;
    throw err;
  }

  if (!billsViaMarzPay() || code !== 'UG') {
    return {
      billers: [],
      countryCode: code,
      provider: 'marzpay',
      marzPayMock: marzPayClient.marzPayIsMock(),
      billFeeFiat: marzPayClient.marzPayBillFeeFiat(),
      message: 'Bills are available in Uganda first.',
    };
  }
  const [services, areas] = await Promise.all([
    marzPayClient.listBillServices(),
    marzPayClient.listNwscAreas().catch(() => []),
  ]);
  return {
    billers: marzPayClient.servicesToBillers(services, { countryCode: code, areas }),
    countryCode: code,
    provider: 'marzpay',
    marzPayMock: marzPayClient.marzPayIsMock(),
    billFeeFiat: marzPayClient.marzPayBillFeeFiat(),
    nwscAreas: areas,
  };
}

export async function listBillBouquets(utilityCode) {
  if (!billsViaMarzPay()) {
    const err = new Error('Bouquet catalog requires MarzPay bills');
    err.status = 400;
    throw err;
  }
  return marzPayClient.listBouquetCodes(utilityCode);
}

export async function lookupBillAccount({
  billerId,
  subscriberAccount,
  fiatAmount,
  billerServiceType,
  area,
}) {
  const account = normalizeSubscriberAccount(subscriberAccount);
  if (!billerId || !account || account.length < 4) {
    const err = new Error('billerId and subscriberAccount are required');
    err.status = 400;
    throw err;
  }

  if (!billsViaMarzPay()) {
    const err = new Error('Bills are available in Uganda first');
    err.status = 400;
    throw err;
  }
  const verified = await marzPayClient.verifyBillAccount({
    utilityCode: billerId,
    meterNumber: account,
    area,
  });
  return {
    ...verified,
    billerId: String(billerId),
    subscriberAccount: account,
    serviceType: verified.customerType || billerServiceType || null,
    marzPayMock: marzPayClient.marzPayIsMock(),
  };
}

export async function createQuote({
  userId,
  countryCode,
  networkCode,
  recipientPhone,
  fiatAmount,
  utilityType: requestedType = 'airtime',
  operatorId,
  bundleDescription,
  billerName,
  subscriberAccount,
  billerServiceType,
  billerType,
  area,
  bouquetCode,
  notifyPhone,
  customerName,
}) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  const utilityType = String(requestedType || 'airtime').toLowerCase();

  if (!countryService.isActiveCountry(code)) {
    const err = new Error(`Unsupported country: ${code}`);
    err.status = 400;
    throw err;
  }

  if (utilityType === 'bill') {
    const account = normalizeSubscriberAccount(subscriberAccount || recipientPhone);
    if (!operatorId) {
      const err = new Error('billerId is required');
      err.status = 400;
      throw err;
    }
    if (!account || account.length < 4) {
      const err = new Error('Valid meter or account number is required');
      err.status = 400;
      throw err;
    }

    const currency = countryService.getCurrencyForCountry(code);
    const fiat = Number(fiatAmount);
    const utilityCode = marzPayClient.normalizeUtilityCode(operatorId);
    const needsArea = utilityCode === 'NWSC';
    const needsBouquet = utilityCode === 'DSTV' || utilityCode === 'GOTV';
    const marzPayFeeFiat = marzPayClient.marzPayBillFeeFiat();
    const platformFeeFiat = utilityPricing.rowanBillFeeFiat(fiat);
    const providerFeeFiat = marzPayFeeFiat + platformFeeFiat;
    const phone = normalizePhone(notifyPhone || recipientPhone, code);

    if (needsArea && !String(area || '').trim()) {
      const err = new Error('NWSC area is required (e.g. Kampala)');
      err.status = 400;
      throw err;
    }
    if (needsBouquet && !String(bouquetCode || '').trim()) {
      const err = new Error('TV bouquet code is required');
      err.status = 400;
      throw err;
    }
    if (!phone || phone.length < 11) {
      const err = new Error('A Uganda phone number is required for bill confirmation SMS');
      err.status = 400;
      throw err;
    }
    if (fiat < config.utilities.minFiatAmount || fiat > config.utilities.maxFiatAmount) {
      const err = new Error(
        `Amount must be between ${config.utilities.minFiatAmount} and ${config.utilities.maxFiatAmount} ${currency}`
      );
      err.status = 400;
      throw err;
    }

    const chargeableFiat = fiat + providerFeeFiat;
    const pricing = await utilityPricing.quoteUtilityPurchase({
      fiatAmount: fiat,
      fiatCurrency: currency,
      extraFiat: providerFeeFiat,
      platformFeeFiat,
    });
    pricing.billFiatAmount = fiat;
    pricing.providerFeeFiat = providerFeeFiat;
    pricing.marzPayFeeFiat = marzPayFeeFiat;
    pricing.platformFeeFiat = platformFeeFiat;
    pricing.chargeableFiat = chargeableFiat;

    const resolvedBillerName = billerName || bundleDescription || `Biller ${utilityCode}`;
    const billLabel = bundleDescription
      || `${resolvedBillerName}`.trim().slice(0, 500);

    const quote = await insertUtilityQuote({
      userId,
      utilityType: 'bill',
      code,
      networkCode: 'BILL',
      operatorId: utilityCode,
      operatorName: resolvedBillerName,
      recipientValue: account,
      pricing,
      bundleLabel: billLabel,
      provider: 'marzpay',
      receipt: {
        provider: 'marzpay',
        utilityCode,
        area: area || null,
        bouquetCode: bouquetCode || null,
        notifyPhone: phone ? marzPayClient.formatMarzPhone(phone) : null,
        customerName: customerName || null,
        providerFeeFiat,
        marzPayFeeFiat,
        platformFeeFiat,
      },
    });

    return {
      ...quote,
      serviceType: billerServiceType || (utilityCode === 'LIGHT' ? 'PREPAID' : null),
      billerType: billerType || null,
      providerFeeFiat,
      billFiatAmount: fiat,
    };
  }

  const phone = normalizePhone(recipientPhone, code);
  const currency = countryService.getCurrencyForCountry(code);
  const fiat = Number(fiatAmount);

  if (airtimeViaMarzPay(code)) {
    const limits = await marzPayClient.getAirtimeLimits({
      msisdn: phone,
      networkCode: String(networkCode || '').trim().toUpperCase(),
    });
    const resolvedNetwork = marzNetworkToRowan(limits.detectedNetwork);
    let bundleId = null;
    if (utilityType === 'data') {
      const catalog = await marzPayClient.listAirtimeBundles({
        msisdn: phone,
        networkCode: resolvedNetwork,
      });
      const match = (catalog.bundles || []).find((b) => (
        String(b.bundleId || b.operatorId) === String(operatorId)
        || Number(b.fiatAmount) === fiat
      ));
      if (!match) {
        const err = new Error('Select a valid data bundle from the catalog');
        err.status = 400;
        throw err;
      }
      bundleId = match.bundleId || match.operatorId;
      if (Number(match.fiatAmount) !== fiat) {
        const err = new Error('Bundle price does not match the selected plan');
        err.status = 400;
        throw err;
      }
    } else {
      assertFiatAmountAllowed({
        fiatAmount: fiat,
        utilityType,
        limits,
        fiatCurrency: currency,
      });
    }

    const pricing = await utilityPricing.quoteUtilityPurchase({
      fiatAmount: fiat,
      fiatCurrency: currency,
    });
    const bundleLabel = bundleDescription ? String(bundleDescription).trim().slice(0, 500) : null;

    return insertUtilityQuote({
      userId,
      utilityType,
      code,
      networkCode: resolvedNetwork,
      operatorId: bundleId || limits.operatorId,
      operatorName: limits.operatorName,
      recipientValue: phone,
      pricing,
      bundleLabel,
      provider: 'marzpay',
      receipt: {
        provider: 'marzpay',
        purchaseType: utilityType === 'data' ? 'bundle' : 'airtime',
        bundleId,
        detectedNetwork: limits.detectedNetwork,
      },
    });
  }

  const err = new Error('Airtime and data are available in Uganda first');
  err.status = 400;
  throw err;
}

export async function completePurchase({ userId, quoteId, paymentTxHash, mockSkipPayment = false }) {
  const purchaseRes = await db.query(
    `SELECT up.*, u.stellar_address
     FROM utility_purchases up
     JOIN users u ON u.id = up.user_id
     WHERE up.id = $1 AND up.user_id = $2`,
    [quoteId, userId]
  );
  const purchase = purchaseRes.rows[0];
  if (!purchase) {
    const err = new Error('Quote not found');
    err.status = 404;
    throw err;
  }

  if (purchase.status === 'COMPLETED') {
    return formatPurchase(purchase, { alreadyCompleted: true });
  }

  const retryFailedBill = purchase.status === 'FAILED'
    && Boolean(purchase.payment_tx_hash)
    && (
      purchase.utility_type === 'bill'
      || purchase.provider === 'marzpay'
      || (['airtime', 'data'].includes(purchase.utility_type) && airtimeViaMarzPay(purchase.country_code))
    );

  if (!retryFailedBill && purchase.status !== 'QUOTED' && purchase.status !== 'PENDING_PAYMENT') {
    const err = new Error(`Purchase cannot be completed from status ${purchase.status}`);
    err.status = 409;
    throw err;
  }

  if (!retryFailedBill && new Date(purchase.expires_at) < new Date()) {
    await db.query(
      `UPDATE utility_purchases SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`,
      [quoteId]
    );
    const err = new Error('Quote expired — request a new quote');
    err.status = 410;
    throw err;
  }

  if (retryFailedBill) {
    await db.query(
      `UPDATE utility_purchases
       SET status = 'PROCESSING', error_message = NULL, updated_at = NOW()
       WHERE id = $1`,
      [quoteId]
    );
  } else {
    const allowMock = config.utilities.allowMockPurchase && !paymentTxHash;
    if (!paymentTxHash && !allowMock) {
      const err = new Error('paymentTxHash is required');
      err.status = 400;
      err.code = 'PAYMENT_TX_REQUIRED';
      throw err;
    }

    if (!allowMock) {
      const verification = await utilityUsdcService.verifyUtilityUsdcPayment({
        paymentTxHash,
        expectedFrom: purchase.stellar_address,
        expectedUsdc: Number(purchase.usdc_amount),
        expectedMemo: purchase.memo,
      });

      if (!verification.ok) {
        const err = new Error(verification.reason);
        err.status = 400;
        err.code = verification.code;
        throw err;
      }
    }

    await db.query(
      `UPDATE utility_purchases
       SET status = 'PROCESSING', payment_tx_hash = $2, updated_at = NOW()
       WHERE id = $1`,
      [quoteId, paymentTxHash || `MOCK-${Date.now()}`]
    );
  }

  let reloadlyResult;
  let externalRef;

  if (purchase.utility_type === 'bill') {
    if (!purchase.operator_id) {
      await failPurchase(quoteId, 'Biller not configured on quote');
      const err = new Error('Biller not configured on quote');
      err.status = 422;
      throw err;
    }
    const billMeta = readReceipt(purchase);
    try {
      if (!billMeta.notifyPhone) {
        throw Object.assign(new Error('Phone number missing on quote — get a new quote'), { status: 422 });
      }
      let existingPay = null;
      try {
        existingPay = await marzPayClient.getBillPayment(purchase.id);
      } catch {
        existingPay = null;
      }
      const existingStatus = String(
        existingPay?.data?.transaction?.status || existingPay?.status || ''
      ).toLowerCase();
      if (['completed', 'success', 'successful', 'pending'].includes(existingStatus)) {
        reloadlyResult = existingPay;
      } else {
        reloadlyResult = await marzPayClient.payBill({
          reference: purchase.id,
          utilityCode: purchase.operator_id,
          meterNumber: purchase.recipient_phone,
          phoneNumber: billMeta.notifyPhone,
          amount: Number(purchase.fiat_amount),
          area: billMeta.area,
          bouquetCode: billMeta.bouquetCode,
          customerName: billMeta.customerName,
        });
      }
      reloadlyResult.provider = 'marzpay';
    } catch (err) {
      const reason = friendlyBillPayError(err);
      await failPurchase(quoteId, reason);
      const wrap = new Error(reason);
      wrap.status = err.status || 502;
      wrap.code = err.code;
      throw wrap;
    }
    externalRef = reloadlyResult.data?.transaction?.reference
      || reloadlyResult.data?.transaction?.uuid
      || reloadlyResult.data?.transaction?.provider_reference
      || reloadlyResult.referenceId
      || reloadlyResult.transaction?.referenceId
      || reloadlyResult.id
      || reloadlyResult.transactionId
      || purchase.id;
  } else {
    const billMeta = readReceipt(purchase);
    const purchaseType = purchase.utility_type === 'data' || billMeta.purchaseType === 'bundle'
      ? 'bundle'
      : 'airtime';
    try {
      let existingPay = null;
      try {
        existingPay = await marzPayClient.getAirtimePurchase(purchase.id);
      } catch {
        existingPay = null;
      }
      const existingStatus = String(existingPay?.data?.status || existingPay?.status || '').toLowerCase();
      if (['completed', 'success', 'successful', 'pending'].includes(existingStatus)) {
        reloadlyResult = existingPay;
      } else {
        reloadlyResult = await marzPayClient.purchaseAirtimeData({
          reference: purchase.id,
          purchaseType,
          msisdn: purchase.recipient_phone,
          amount: Number(purchase.fiat_amount),
          bundleId: billMeta.bundleId || purchase.operator_id,
        });
      }
      const liveStatus = String(reloadlyResult?.data?.status || reloadlyResult?.status || '').toLowerCase();
      if (liveStatus === 'pending') {
        reloadlyResult = await marzPayClient.waitForAirtimeSettlement(purchase.id);
      }
      reloadlyResult.provider = 'marzpay';
    } catch (err) {
      const reason = friendlyBillPayError(err);
      await failPurchase(quoteId, reason);
      const wrap = new Error(reason);
      wrap.status = err.status || 502;
      wrap.code = err.code;
      throw wrap;
    }
    externalRef = reloadlyResult.data?.reference
      || reloadlyResult.data?.uuid
      || reloadlyResult.data?.provider_reference
      || reloadlyResult.reference
      || purchase.id;
  }

  const rawBillStatus = String(
    reloadlyResult?.data?.transaction?.status
    || reloadlyResult?.data?.status
    || reloadlyResult?.transaction?.status
    || reloadlyResult?.status
    || 'COMPLETED'
  ).toUpperCase();
  const finalStatus = rawBillStatus === 'SUCCESS' || rawBillStatus === 'SUCCESSFUL'
    ? 'COMPLETED'
    : rawBillStatus === 'PENDING'
      ? 'PROCESSING'
      : rawBillStatus;
  const purchaseStatus = finalStatus === 'FAILED'
    ? 'FAILED'
    : finalStatus === 'PROCESSING'
      ? 'PROCESSING'
      : 'COMPLETED';

  const completed = await db.query(
    `UPDATE utility_purchases
     SET status = $5::utility_purchase_status,
         operator_id = COALESCE(operator_id, $2),
         external_ref = $3,
         receipt = $4,
         completed_at = CASE WHEN $5::text = 'COMPLETED' THEN NOW() ELSE completed_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      quoteId,
      purchase.utility_type === 'bill' ? purchase.operator_id : String(purchase.operator_id || ''),
      externalRef,
      JSON.stringify({
        ...readReceipt(purchase),
        ...reloadlyResult,
        provider: purchase.provider || readReceipt(purchase).provider || 'marzpay',
      }),
      purchaseStatus,
    ]
  );

  return formatPurchase(completed.rows[0], {
    reloadlyMock: marzPayClient.marzPayIsMock(),
    marzPayMock: marzPayClient.marzPayIsMock(),
  });
}

async function failPurchase(id, message) {
  await db.query(
    `UPDATE utility_purchases
     SET status = 'FAILED', error_message = $2, updated_at = NOW()
     WHERE id = $1`,
    [id, message]
  );
}

export async function refreshBillDelivery({ userId, purchaseId }) {
  const purchaseRes = await db.query(
    `SELECT * FROM utility_purchases WHERE id = $1 AND user_id = $2`,
    [purchaseId, userId]
  );
  const purchase = purchaseRes.rows[0];
  if (!purchase) {
    const err = new Error('Purchase not found');
    err.status = 404;
    throw err;
  }
  if (purchase.utility_type !== 'bill') {
    return formatPurchase(purchase);
  }

  let receipt = null;
  try {
    receipt = typeof purchase.receipt === 'string' ? JSON.parse(purchase.receipt) : purchase.receipt;
  } catch {
    receipt = null;
  }

  let reloadlyResult;
  try {
    reloadlyResult = await marzPayClient.waitForBillSettlement(purchase.id);
    reloadlyResult.provider = 'marzpay';
  } catch (err) {
    logger.warn('[UtilityService] refreshBillDelivery poll failed', {
      purchaseId,
      error: err.message,
    });
    return formatPurchase(purchase, {
      reloadlyMock: marzPayClient.marzPayIsMock(),
      marzPayMock: marzPayClient.marzPayIsMock(),
    });
  }

  const finalStatus = String(
    reloadlyResult?.data?.transaction?.status
    || reloadlyResult?.transaction?.status
    || reloadlyResult?.status
    || ''
  ).toUpperCase();
  const purchaseStatus = finalStatus === 'SUCCESSFUL' || finalStatus === 'SUCCESS' || finalStatus === 'COMPLETED'
    ? 'COMPLETED'
    : finalStatus === 'FAILED'
      ? 'FAILED'
      : purchase.status;

  const updated = await db.query(
    `UPDATE utility_purchases
     SET status = $2::utility_purchase_status,
         receipt = $3,
         completed_at = CASE WHEN $2::text = 'COMPLETED' THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [purchaseId, purchaseStatus, JSON.stringify({ ...receipt, ...reloadlyResult, provider: 'marzpay' })]
  );

  return formatPurchase(updated.rows[0], {
    reloadlyMock: marzPayClient.marzPayIsMock(),
    marzPayMock: marzPayClient.marzPayIsMock(),
  });
}

export async function getPurchaseHistory(userId, limit = 20) {
  const result = await db.query(
    `SELECT id, utility_type, country_code, network_code, recipient_phone,
            fiat_amount, fiat_currency, usdc_amount, status, external_ref,
            memo, completed_at, created_at, error_message, bundle_description,
            operator_name, payment_tx_hash
     FROM utility_purchases
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, Math.min(limit, 50)]
  );
  return result.rows.map((row) => formatPurchase(row));
}

/**
 * Single utility purchase for status / deep-link screens.
 */
export async function getPurchaseById(userId, purchaseId) {
  const result = await db.query(
    `SELECT *
     FROM utility_purchases
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [purchaseId, userId]
  );
  const row = result.rows[0];
  if (!row) {
    const err = new Error('Purchase not found');
    err.status = 404;
    throw err;
  }
  return formatPurchase(row, {
    reloadlyMock: marzPayClient.marzPayIsMock(),
    marzPayMock: marzPayClient.marzPayIsMock(),
  });
}

function formatPurchase(row, extra = {}) {
  let receipt = null;
  if (row.receipt) {
    try {
      receipt = typeof row.receipt === 'string' ? JSON.parse(row.receipt) : row.receipt;
    } catch {
      receipt = null;
    }
  }
  const electricityDelivery = extractBillDelivery(receipt);

  return {
    id: row.id,
    type: row.utility_type,
    countryCode: row.country_code,
    networkCode: row.network_code,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    recipientPhone: row.recipient_phone,
    fiatAmount: Number(row.fiat_amount),
    fiatCurrency: row.fiat_currency,
    usdcAmount: Number(row.usdc_amount),
    platformFeeUsdc: Number(row.platform_fee_usdc || 0),
    fxRate: row.fx_rate != null ? Number(row.fx_rate) : null,
    status: row.status,
    memo: row.memo,
    paymentTxHash: row.payment_tx_hash,
    externalRef: row.external_ref,
    treasuryPublicKey: extra.treasuryPublicKey || utilityUsdcService.getUtilityTreasuryPublicKey(),
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    bundleDescription: row.bundle_description || null,
    reloadlyMock: extra.reloadlyMock ?? marzPayClient.marzPayIsMock(),
    marzPayMock: extra.marzPayMock ?? extra.reloadlyMock ?? marzPayClient.marzPayIsMock(),
    pricing: extra.pricing,
    alreadyCompleted: extra.alreadyCompleted || false,
    serviceType: extra.serviceType || receipt?.customerType || (row.operator_id === 'LIGHT' ? 'PREPAID' : null),
    billSettlementFallback: extra.billSettlementFallback || false,
    electricityEstimate: extra.electricityEstimate || null,
    subscriberName: electricityDelivery?.customerName || extra.subscriberName || receipt?.customerName || null,
    electricityToken: electricityDelivery?.token || null,
    electricityUnits: electricityDelivery?.unitsDisplay || electricityDelivery?.units || null,
    electricityUnitsSource: electricityDelivery?.source || null,
    billsProvider: row.provider || receipt?.provider || null,
    providerFeeFiat: extra.pricing?.providerFeeFiat ?? receipt?.providerFeeFiat ?? null,
    billFiatAmount: extra.pricing?.billFiatAmount ?? Number(row.fiat_amount),
  };
}

export default {
  listProviders,
  listOperators,
  getTopupLimits,
  getDataAvailability,
  listDataBundles,
  listBillers,
  listBillBouquets,
  lookupBillAccount,
  createQuote,
  completePurchase,
  refreshBillDelivery,
  getPurchaseHistory,
  getPurchaseById,
};
