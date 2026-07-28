/**
 * Utility purchase orchestration (B2 + B6).
 */

import crypto from 'crypto';
import db from '../../db/index.js';
import config from '../../config/index.js';
import countryService from '../countries/countryService.js';
import reloadlyClient from './reloadlyClient.js';
import reloadlyUtilityPaymentsClient from './reloadlyUtilityPaymentsClient.js';
import { extractBundlesFromOperator } from './utilityBundles.js';
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
  const code = err?.body?.errorCode || err?.code;
  if (/insufficient.?balance/i.test(msg) || code === 'INSUFFICIENT_BALANCE') {
    return 'Reloadly Utilities wallet balance is too low. Fund it in the Reloadly dashboard (Utilities wallet, not Top-ups), then retry.';
  }
  if (/retrieve\/update resources/i.test(msg)) {
    return 'The utility provider (e.g. Umeme) is temporarily unavailable. If USDC was already sent, save your memo and contact support — we will retry or refund.';
  }
  if (code === 'INVALID_SUBSCRIBER_ACCOUNT_NUMBER') {
    return 'Invalid meter or account number for this provider. Check the number and try again.';
  }
  if (code === 'BILLER_NOT_SUPPORTED' || code === 'BILLER_NOT_FOUND') {
    return 'This bill provider is not available right now. Try another provider or contact support.';
  }
  return msg;
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
}) {
  const memo = buildMemo();
  const expiresAt = new Date(Date.now() + config.utilities.quoteTtlSeconds * 1000);
  const treasuryPublicKey = utilityUsdcService.getUtilityTreasuryPublicKey();

  const result = await db.query(
    `INSERT INTO utility_purchases
       (user_id, utility_type, country_code, network_code, operator_id, operator_name,
        recipient_phone, fiat_amount, fiat_currency, usdc_amount, platform_fee_usdc,
        fx_rate, status, memo, expires_at, bundle_description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'QUOTED', $13, $14, $15)
     RETURNING *`,
    [
      userId,
      utilityType,
      code,
      networkCode,
      operatorId ? String(operatorId) : null,
      operatorName,
      recipientValue,
      pricing.fiatAmount,
      pricing.fiatCurrency,
      pricing.totalUsdc,
      pricing.platformFeeUsdc,
      pricing.fxRate,
      memo,
      expiresAt,
      bundleLabel,
    ]
  );

  const reloadlyMock = utilityType === 'bill'
    ? reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock()
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
  const operators = await reloadlyClient.getOperatorsByCountry(code);
  return Array.isArray(operators) ? operators : operators?.content || [];
}

export async function listDataBundles({ countryCode, networkCode, recipientPhone }) {
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

  let detected;
  try {
    detected = await reloadlyClient.autoDetectOperator(code, phone);
  } catch (err) {
    logger.warn('[UtilityService] auto-detect for bundles failed', { error: err.message });
    const wrap = new Error('Could not detect operator for this phone number');
    wrap.status = 422;
    throw wrap;
  }

  const operatorId = detected?.operatorId ?? detected?.id;
  if (!operatorId) {
    const err = new Error('Could not detect operator for this phone number');
    err.status = 422;
    throw err;
  }

  const operator = await reloadlyClient.getOperatorById(operatorId);
  const currency = countryService.getCurrencyForCountry(code);
  let catalog = extractBundlesFromOperator(operator, currency);

  if (!catalog.bundles.length) {
    try {
      const allOps = await reloadlyClient.getOperatorsByCountry(code);
      const ops = Array.isArray(allOps) ? allOps : allOps?.content || [];
      const method = countryService.getPaymentMethods(code).find((m) => m.networkCode === network);
      const networkToken = (method?.label || network).split(/[\s_]/)[0].toLowerCase();
      const dataOp = ops.find(
        (o) => o.data && String(o.name || '').toLowerCase().includes(networkToken)
      );
      if (dataOp) {
        const dataOperatorId = dataOp.operatorId ?? dataOp.id;
        const dataOperator = await reloadlyClient.getOperatorById(dataOperatorId);
        catalog = extractBundlesFromOperator(dataOperator, currency);
      }
    } catch (err) {
      logger.warn('[UtilityService] data operator fallback failed', { error: err.message });
    }
  }

  if (!catalog.bundles.length) {
    const err = new Error(
      'No fixed data bundles available for this number. Try airtime or another network.'
    );
    err.status = 422;
    throw err;
  }

  return {
    ...catalog,
    countryCode: code,
    networkCode: network,
    recipientPhone: phone,
    reloadlyMock: reloadlyClient.reloadlyIsMock(),
  };
}

export async function listBillers(countryCode) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  if (!countryService.isActiveCountry(code)) {
    const err = new Error(`Unsupported country: ${code}`);
    err.status = 400;
    throw err;
  }

  const raw = await reloadlyUtilityPaymentsClient.getBillers({ countryISOCode: code });
  const billers = normalizeBillersResponse(raw);
  return {
    billers,
    countryCode: code,
    reloadlyMock: reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock(),
  };
}

export async function lookupBillAccount({
  billerId,
  subscriberAccount,
  fiatAmount,
  billerServiceType,
}) {
  const account = normalizeSubscriberAccount(subscriberAccount);
  if (!billerId || !account || account.length < 4) {
    const err = new Error('billerId and subscriberAccount are required');
    err.status = 400;
    throw err;
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
    if (fiat < config.utilities.minFiatAmount || fiat > config.utilities.maxFiatAmount) {
      const err = new Error(
        `Amount must be between ${config.utilities.minFiatAmount} and ${config.utilities.maxFiatAmount} ${currency}`
      );
      err.status = 400;
      throw err;
    }

    const pricing = await utilityPricing.quoteUtilityPurchase({
      fiatAmount: fiat,
      fiatCurrency: currency,
    });

    const resolvedBillerName = billerName || bundleDescription || `Biller ${operatorId}`;
    const billLabel = bundleDescription
      || `${resolvedBillerName}`.trim().slice(0, 500);

    const quote = await insertUtilityQuote({
      userId,
      utilityType: 'bill',
      code,
      networkCode: 'BILL',
      operatorId,
      operatorName: resolvedBillerName,
      recipientValue: account,
      pricing,
      bundleLabel: billLabel,
    });

    return {
      ...quote,
      serviceType: billerServiceType || null,
      billerType: billerType || null,
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
  if (fiat < config.utilities.minFiatAmount || fiat > config.utilities.maxFiatAmount) {
    const err = new Error(
      `Amount must be between ${config.utilities.minFiatAmount} and ${config.utilities.maxFiatAmount} ${currency}`
    );
    err.status = 400;
    throw err;
  }

  const pricing = await utilityPricing.quoteUtilityPurchase({
    fiatAmount: fiat,
    fiatCurrency: currency,
  });

  let resolvedOperatorId = operatorId;
  let operatorName = null;
  if (resolvedOperatorId) {
    try {
      const op = await reloadlyClient.getOperatorById(resolvedOperatorId);
      operatorName = op?.name || null;
    } catch (err) {
      logger.warn('[UtilityService] operator lookup failed', { error: err.message });
    }
  }
  if (!resolvedOperatorId) {
    try {
      const detected = await reloadlyClient.autoDetectOperator(code, phone);
      resolvedOperatorId = detected?.operatorId;
      operatorName = detected?.name || operatorName;
    } catch (err) {
      logger.warn('[UtilityService] auto-detect operator failed', { error: err.message });
    }
  }

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
    try {
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
    } catch (err) {
      const reason = friendlyBillPayError(err);
      await failPurchase(quoteId, reason);
      const wrap = new Error(reason);
      wrap.status = err.status || 502;
      wrap.code = err.code;
      throw wrap;
    }
    externalRef = reloadlyResult.referenceId
      || reloadlyResult.transaction?.referenceId
      || reloadlyResult.id
      || reloadlyResult.transactionId;
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

  const finalStatus = purchase.utility_type === 'bill'
    ? String(
      reloadlyResult?.transaction?.status
      || reloadlyResult?.status
      || 'COMPLETED'
    ).toUpperCase()
    : 'COMPLETED';
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
      JSON.stringify(reloadlyResult),
      purchaseStatus,
    ]
  );

  return formatPurchase(completed.rows[0], {
    reloadlyMock: purchase.utility_type === 'bill'
      ? reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock()
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

  const txId = getReloadlyTransactionId(receipt);
  if (!txId) {
    return formatPurchase(purchase, {
      reloadlyMock: reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock(),
    });
  }

  let reloadlyResult;
  try {
    reloadlyResult = await reloadlyUtilityPaymentsClient.waitForBillSettlement(
      { id: txId, ...receipt },
      { maxAttempts: 8, delayMs: 2500 }
    );
  } catch (err) {
    logger.warn('[UtilityService] refreshBillDelivery poll failed', {
      purchaseId,
      error: err.message,
    });
    return formatPurchase(purchase, {
      reloadlyMock: reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock(),
    });
  }

  const finalStatus = String(
    reloadlyResult?.transaction?.status || reloadlyResult?.status || ''
  ).toUpperCase();
  const purchaseStatus = finalStatus === 'SUCCESSFUL'
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
    [purchaseId, purchaseStatus, JSON.stringify(reloadlyResult)]
  );

  return formatPurchase(updated.rows[0], {
    reloadlyMock: reloadlyUtilityPaymentsClient.reloadlyUtilitiesIsMock(),
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
    serviceType: extra.serviceType || null,
    billSettlementFallback: extra.billSettlementFallback || false,
    electricityEstimate: extra.electricityEstimate || null,
    subscriberName: electricityDelivery?.customerName || extra.subscriberName || null,
    electricityToken: electricityDelivery?.token || null,
    electricityUnits: electricityDelivery?.unitsDisplay || electricityDelivery?.units || null,
    electricityUnitsSource: electricityDelivery?.source || null,
  };
}

export default {
  listProviders,
  listOperators,
  listDataBundles,
  listBillers,
  lookupBillAccount,
  createQuote,
  completePurchase,
  refreshBillDelivery,
  getPurchaseHistory,
};
