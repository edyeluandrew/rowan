/**
 * Utility purchase orchestration (B2 + B6).
 */

import crypto from 'crypto';
import db from '../../db/index.js';
import config from '../../config/index.js';
import countryService from '../countries/countryService.js';
import reloadlyClient from './reloadlyClient.js';
import reloadlyUtilityPaymentsClient from './reloadlyUtilityPaymentsClient.js';
import marzPayClient from './marzPayClient.js';
import { extractBundlesFromOperator } from './utilityBundles.js';
import {
  assertFiatAmountAllowed,
  getTopupLimits,
  getDataAvailability,
  listNormalizedOperators,
  resolveOperatorForPhone,
} from './reloadlyOperatorCatalog.js';
import { normalizeBillersResponse } from './utilityBillers.js';
import { extractBillDelivery, getReloadlyTransactionId } from './utilityElectricity.js';
import utilityPricing from './utilityPricing.js';
import utilityUsdcService from './utilityUsdcService.js';
import logger from '../../utils/logger.js';

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

function buildBillReferenceId(purchaseId) {
  const compact = String(purchaseId || '').replace(/-/g, '').slice(0, 16);
  return `ROWAN-${compact}`;
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
  provider = 'reloadly',
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

  const reloadlyMock = utilityType === 'bill'
    ? (provider === 'marzpay' ? marzPayClient.marzPayIsMock() : reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock())
    : reloadlyClient.reloadlyIsMock();

  return formatPurchase(result.rows[0], {
    treasuryPublicKey,
    pricing,
    reloadlyMock,
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
  return listNormalizedOperators(code);
}

export async function getReloadlyDataAvailability(countryCode) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  if (!countryService.isActiveCountry(code)) {
    const err = new Error(`Unsupported country: ${code}`);
    err.status = 400;
    throw err;
  }
  return getDataAvailability(code);
}

export async function getReloadlyTopupLimits({
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
  if (!countryService.isValidNetworkForCountry(code, network)) {
    const err = new Error(`Network ${network} is not valid for ${code}`);
    err.status = 400;
    throw err;
  }
  if (!phone || phone.length < 9) {
    const err = new Error('Valid recipient phone is required');
    err.status = 400;
    throw err;
  }

  return getTopupLimits({
    countryCode: code,
    networkCode: network,
    recipientPhone: phone,
    utilityType,
  });
}

export async function listDataBundles({ countryCode, networkCode, recipientPhone }) {
  const limits = await getReloadlyTopupLimits({
    countryCode,
    networkCode,
    recipientPhone,
    utilityType: 'data',
  });

  return {
    operatorId: limits.operatorId,
    operatorName: limits.operatorName,
    denominationType: limits.denominationType,
    fiatCurrency: limits.fiatCurrency,
    bundles: limits.bundles,
    countryCode: limits.countryCode,
    networkCode: limits.networkCode,
    recipientPhone: normalizePhone(recipientPhone, limits.countryCode),
    reloadlyMock: limits.reloadlyMock,
  };
}

export async function listBillers(countryCode) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  if (!countryService.isActiveCountry(code)) {
    const err = new Error(`Unsupported country: ${code}`);
    err.status = 400;
    throw err;
  }

  if (billsViaMarzPay()) {
    if (code !== 'UG') {
      return {
        billers: [],
        countryCode: code,
        provider: 'marzpay',
        marzPayMock: marzPayClient.marzPayIsMock(),
        billFeeFiat: marzPayClient.marzPayBillFeeFiat(),
        message: 'MarzPay bills are available in Uganda first.',
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

  const raw = await reloadlyUtilityPaymentsClient.getBillers({ countryISOCode: code });
  const billers = normalizeBillersResponse(raw);
  return {
    billers,
    countryCode: code,
    provider: 'reloadly',
    reloadlyMock: reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock(),
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

  if (billsViaMarzPay()) {
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

  const result = await reloadlyUtilityPaymentsClient.lookupBillAccount({
    billerId,
    subscriberAccountNumber: account,
    amount: Number(fiatAmount) || 0,
    useLocalAmount: true,
  });

  return {
    ...result,
    billerId: String(billerId),
    subscriberAccount: account,
    serviceType: billerServiceType || null,
    reloadlyUtilitiesMock: reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock(),
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
    const utilityCode = billsViaMarzPay()
      ? marzPayClient.normalizeUtilityCode(operatorId)
      : String(operatorId);
    const needsArea = utilityCode === 'NWSC';
    const needsBouquet = utilityCode === 'DSTV' || utilityCode === 'GOTV';
    const providerFeeFiat = billsViaMarzPay() ? marzPayClient.marzPayBillFeeFiat() : 0;
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
    if (billsViaMarzPay() && (!phone || phone.length < 11)) {
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
      fiatAmount: chargeableFiat,
      fiatCurrency: currency,
    });
    pricing.billFiatAmount = fiat;
    pricing.providerFeeFiat = providerFeeFiat;
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
      provider: billsViaMarzPay() ? 'marzpay' : 'reloadly',
      receipt: {
        provider: billsViaMarzPay() ? 'marzpay' : 'reloadly',
        utilityCode,
        area: area || null,
        bouquetCode: bouquetCode || null,
        notifyPhone: phone ? marzPayClient.formatMarzPhone(phone) : null,
        customerName: customerName || null,
        providerFeeFiat,
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

  const network = String(networkCode || '').trim().toUpperCase();
  const phone = normalizePhone(recipientPhone, code);
  if (!countryService.isValidNetworkForCountry(code, network)) {
    const err = new Error(`Network ${network} is not valid for ${code}`);
    err.status = 400;
    throw err;
  }

  const currency = countryService.getCurrencyForCountry(code);
  const fiat = Number(fiatAmount);

  const { operator, limits } = await resolveOperatorForPhone({
    countryCode: code,
    networkCode: network,
    recipientPhone: phone,
    utilityType,
  });

  let bundleCatalog = null;
  if (utilityType === 'data') {
    bundleCatalog = extractBundlesFromOperator(operator, currency);
  }

  assertFiatAmountAllowed({
    fiatAmount: fiat,
    utilityType,
    limits,
    bundles: bundleCatalog?.bundles,
    fiatCurrency: currency,
  });

  const pricing = await utilityPricing.quoteUtilityPurchase({
    fiatAmount: fiat,
    fiatCurrency: currency,
  });

  const resolvedOperatorId = operatorId || limits.operatorId;
  const operatorName = limits.operatorName || operator?.name || null;

  const bundleLabel = bundleDescription ? String(bundleDescription).trim().slice(0, 500) : null;

  return insertUtilityQuote({
    userId,
    utilityType,
    code,
    networkCode: network,
    operatorId: resolvedOperatorId,
    operatorName,
    recipientValue: phone,
    pricing,
    bundleLabel,
  });
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

  if (purchase.status !== 'QUOTED' && purchase.status !== 'PENDING_PAYMENT') {
    const err = new Error(`Purchase cannot be completed from status ${purchase.status}`);
    err.status = 409;
    throw err;
  }

  if (new Date(purchase.expires_at) < new Date()) {
    await db.query(
      `UPDATE utility_purchases SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`,
      [quoteId]
    );
    const err = new Error('Quote expired — request a new quote');
    err.status = 410;
    throw err;
  }

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

  let reloadlyResult;
  let externalRef;
  let billSettlementFallback = false;

  if (purchase.utility_type === 'bill') {
    if (!purchase.operator_id) {
      await failPurchase(quoteId, 'Biller not configured on quote');
      const err = new Error('Biller not configured on quote');
      err.status = 422;
      throw err;
    }
    const billMeta = readReceipt(purchase);
    try {
      if (purchase.provider === 'marzpay' || billsViaMarzPay()) {
        if (!billMeta.notifyPhone) {
          throw Object.assign(new Error('Phone number missing on quote — get a new quote'), { status: 422 });
        }
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
        reloadlyResult.provider = 'marzpay';
      } else {
        const billPay = await reloadlyUtilityPaymentsClient.payBillForPurchase({
          billerId: purchase.operator_id,
          subscriberAccountNumber: purchase.recipient_phone,
          amount: Number(purchase.fiat_amount),
          useLocalAmount: true,
          referenceId: buildBillReferenceId(purchase.id),
          countryCode: purchase.country_code,
        });
        reloadlyResult = billPay.result;
        billSettlementFallback = billPay.usedStagingFallback;
        if (billPay.fallbackReason) {
          reloadlyResult._fallbackReason = billPay.fallbackReason;
        }
      }
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
    let operatorId = purchase.operator_id;

    if (!operatorId) {
      const detected = await reloadlyClient.autoDetectOperator(
        purchase.country_code,
        purchase.recipient_phone
      );
      operatorId = detected?.operatorId;
    }

    if (!operatorId) {
      await failPurchase(quoteId, 'Could not resolve mobile operator for this number');
      const err = new Error('Could not resolve mobile operator');
      err.status = 422;
      throw err;
    }

    try {
      reloadlyResult = await reloadlyClient.sendAirtimeTopup({
        operatorId,
        amount: Number(purchase.fiat_amount),
        countryCode: purchase.country_code,
        phoneNumber: purchase.recipient_phone,
        customIdentifier: purchase.id,
      });
    } catch (err) {
      await failPurchase(quoteId, err.message);
      throw err;
    }

    externalRef = reloadlyResult.transactionId
      || reloadlyResult.operatorTransactionId
      || reloadlyResult.customIdentifier;
  }

  const rawBillStatus = purchase.utility_type === 'bill'
    ? String(
      reloadlyResult?.data?.transaction?.status
      || reloadlyResult?.transaction?.status
      || reloadlyResult?.status
      || 'COMPLETED'
    ).toUpperCase()
    : 'COMPLETED';
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
        provider: purchase.provider || readReceipt(purchase).provider || 'reloadly',
      }),
      purchaseStatus,
    ]
  );

  return formatPurchase(completed.rows[0], {
    reloadlyMock: purchase.utility_type === 'bill'
      ? (purchase.provider === 'marzpay' || billsViaMarzPay()
        ? marzPayClient.marzPayIsMock()
        : reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock())
      : reloadlyClient.reloadlyIsMock(),
    billSettlementFallback: purchase.utility_type === 'bill' ? billSettlementFallback : false,
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

  const viaMarz = purchase.provider === 'marzpay' || receipt.provider === 'marzpay';
  let reloadlyResult;
  try {
    if (viaMarz) {
      reloadlyResult = await marzPayClient.waitForBillSettlement(purchase.id);
      reloadlyResult.provider = 'marzpay';
    } else {
      const txId = getReloadlyTransactionId(receipt);
      if (!txId) {
        return formatPurchase(purchase, {
          reloadlyMock: reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock(),
        });
      }
      reloadlyResult = await reloadlyUtilityPaymentsClient.waitForBillSettlement(
        { id: txId, ...receipt },
        { maxAttempts: 8, delayMs: 2500 }
      );
    }
  } catch (err) {
    logger.warn('[UtilityService] refreshBillDelivery poll failed', {
      purchaseId,
      error: err.message,
    });
    return formatPurchase(purchase, {
      reloadlyMock: viaMarz
        ? marzPayClient.marzPayIsMock()
        : reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock(),
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
    [purchaseId, purchaseStatus, JSON.stringify({ ...receipt, ...reloadlyResult, provider: viaMarz ? 'marzpay' : (receipt.provider || 'reloadly') })]
  );

  return formatPurchase(updated.rows[0], {
    reloadlyMock: viaMarz
      ? marzPayClient.marzPayIsMock()
      : reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock(),
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
    reloadlyMock: row.utility_type === 'bill'
      ? (row.provider === 'marzpay' ? marzPayClient.marzPayIsMock() : reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock())
      : reloadlyClient.reloadlyIsMock(),
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
    reloadlyMock: extra.reloadlyMock ?? reloadlyClient.reloadlyIsMock(),
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
  getReloadlyTopupLimits,
  getReloadlyDataAvailability,
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
