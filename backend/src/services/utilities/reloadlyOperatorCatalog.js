/**
 * Reloadly operator catalog — limits and matching from live sandbox/production API.
 * @see https://support.reloadly.com/how-can-i-determine-the-operator-minimum-and-maximum-amount-/values
 */

import countryService from '../countries/countryService.js';
import reloadlyClient from './reloadlyClient.js';
import { extractBundlesFromOperator } from './utilityBundles.js';

function operatorIdOf(operator) {
  return operator?.operatorId ?? operator?.id ?? null;
}

function networkToken(countryCode, networkCode) {
  const methods = countryService.getPaymentMethods(countryCode) || [];
  const method = methods.find((m) => m.networkCode === networkCode);
  return (method?.label || networkCode || '').split(/[\s_]/)[0].toLowerCase();
}

export function operatorMatchesNetwork(operator, token) {
  if (!token) return true;
  const name = String(operator?.name || '').toLowerCase();
  return name.includes(token) || token.includes(name.split(/\s+/)[0]);
}

export function normalizeOperatorsList(raw) {
  return Array.isArray(raw) ? raw : raw?.content || [];
}

/**
 * Extract min/max or fixed amounts from a Reloadly operator record.
 */
export function extractOperatorLimits(operator, fallbackCurrency = 'UGX') {
  const denominationType = String(operator?.denominationType || 'RANGE').toUpperCase();
  const supportsLocal = operator?.supportsLocalAmounts !== false;
  const fiatCurrency = operator?.destinationCurrencyCode
    || operator?.fx?.currencyCode
    || fallbackCurrency;
  const operatorId = operatorIdOf(operator);
  const operatorName = operator?.name || null;

  if (denominationType === 'FIXED') {
    const useLocal = Array.isArray(operator?.localFixedAmounts) && operator.localFixedAmounts.length > 0;
    const amounts = (useLocal ? operator.localFixedAmounts : operator?.fixedAmounts || [])
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    return {
      denominationType: 'FIXED',
      fiatCurrency,
      minFiatAmount: amounts.length ? amounts[0] : null,
      maxFiatAmount: amounts.length ? amounts[amounts.length - 1] : null,
      allowedAmounts: amounts,
      suggestedAmounts: (operator?.suggestedAmounts || []).map(Number).filter((n) => n > 0),
      operatorId: operatorId ? String(operatorId) : null,
      operatorName,
      supportsLocalAmounts: supportsLocal,
      data: Boolean(operator?.data || operator?.bundle),
    };
  }

  let minFiatAmount = null;
  let maxFiatAmount = null;

  if (supportsLocal && operator?.localMinAmount != null && operator?.localMaxAmount != null) {
    minFiatAmount = Number(operator.localMinAmount);
    maxFiatAmount = Number(operator.localMaxAmount);
  } else if (operator?.minAmount != null && operator?.maxAmount != null && operator?.fx?.rate) {
    const rate = Number(operator.fx.rate);
    minFiatAmount = Number(operator.minAmount) * rate;
    maxFiatAmount = Number(operator.maxAmount) * rate;
  } else {
    minFiatAmount = operator?.minAmount != null ? Number(operator.minAmount) : null;
    maxFiatAmount = operator?.maxAmount != null ? Number(operator.maxAmount) : null;
  }

  const suggested = (operator?.suggestedAmounts || []).map(Number).filter((n) => n > 0);

  return {
    denominationType: 'RANGE',
    fiatCurrency,
    minFiatAmount: Number.isFinite(minFiatAmount) ? minFiatAmount : null,
    maxFiatAmount: Number.isFinite(maxFiatAmount) ? maxFiatAmount : null,
    allowedAmounts: [],
    suggestedAmounts: suggested,
    operatorId: operatorId ? String(operatorId) : null,
    operatorName,
    supportsLocalAmounts: supportsLocal,
    data: Boolean(operator?.data || operator?.bundle),
  };
}

export function assertFiatAmountAllowed({
  fiatAmount,
  utilityType,
  limits,
  bundles,
  fiatCurrency,
}) {
  const fiat = Number(fiatAmount);
  const currency = fiatCurrency || limits?.fiatCurrency || 'UGX';

  if (!Number.isFinite(fiat) || fiat <= 0) {
    const err = new Error('fiatAmount must be a positive number');
    err.status = 400;
    throw err;
  }

  if (utilityType === 'data') {
    const catalog = bundles?.length ? bundles : limits?.allowedAmounts?.map((amount) => ({ fiatAmount: amount }));
    if (catalog?.length) {
      const match = catalog.some((b) => Number(b.fiatAmount ?? b) === fiat);
      if (!match) {
        const err = new Error('Selected data plan is not available for this number. Refresh plans and try again.');
        err.status = 400;
        throw err;
      }
      return;
    }
  }

  if (limits?.denominationType === 'FIXED' && limits.allowedAmounts?.length) {
    if (!limits.allowedAmounts.includes(fiat)) {
      const err = new Error(
        `Amount must be one of the available plans: ${limits.allowedAmounts.join(', ')} ${currency}`
      );
      err.status = 400;
      throw err;
    }
    return;
  }

  const min = limits?.minFiatAmount;
  const max = limits?.maxFiatAmount;
  if (min != null && max != null && (fiat < min || fiat > max)) {
    const err = new Error(
      `Amount must be between ${Math.ceil(min)} and ${Math.floor(max)} ${currency}`
    );
    err.status = 400;
    throw err;
  }
}

async function loadCountryOperators(countryCode) {
  const raw = await reloadlyClient.getOperatorsByCountry(countryCode);
  return normalizeOperatorsList(raw);
}

export async function resolveOperatorForPhone({
  countryCode,
  networkCode,
  recipientPhone,
  utilityType = 'airtime',
}) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  const network = String(networkCode || '').trim().toUpperCase();
  const token = networkToken(code, network);
  const preferData = utilityType === 'data';

  let detected = null;
  try {
    detected = await reloadlyClient.autoDetectOperator(code, recipientPhone);
  } catch {
    detected = null;
  }

  const detectedId = operatorIdOf(detected);
  if (detectedId) {
    try {
      const full = await reloadlyClient.getOperatorById(detectedId);
      const limits = extractOperatorLimits(full, countryService.getCurrencyForCountry(code));
      const networkOk = !network || operatorMatchesNetwork(full, token);
      const typeOk = !preferData || limits.data || full?.data || full?.bundle;
      if (networkOk && typeOk) {
        return { operator: full, limits, source: 'auto-detect' };
      }
    } catch {
      /* fall through */
    }
  }

  const ops = await loadCountryOperators(code);
  const candidates = ops.filter((o) => operatorMatchesNetwork(o, token));

  const pick = (list) => {
    if (preferData) {
      return list.find((o) => o.data || o.bundle) || list[0];
    }
    return list.find((o) => !o.data || o.bundle === false) || list[0];
  };

  let chosen = pick(candidates.length ? candidates : ops);
  if (!chosen) {
    const err = new Error('Could not resolve mobile operator for this number');
    err.status = 422;
    throw err;
  }

  const operatorId = operatorIdOf(chosen);
  const operator = operatorId
    ? await reloadlyClient.getOperatorById(operatorId)
    : chosen;
  const limits = extractOperatorLimits(operator, countryService.getCurrencyForCountry(code));

  return { operator, limits, source: 'country-catalog' };
}

export async function getTopupLimits({
  countryCode,
  networkCode,
  recipientPhone,
  utilityType = 'airtime',
}) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  const network = String(networkCode || '').trim().toUpperCase();
  const currency = countryService.getCurrencyForCountry(code);

  if (utilityType === 'data') {
    const { operator, limits, source } = await resolveOperatorForPhone({
      countryCode: code,
      networkCode: network,
      recipientPhone,
      utilityType: 'data',
    });
    const catalog = extractBundlesFromOperator(operator, currency);
    if (!catalog.bundles.length) {
      const err = new Error(
        'No fixed data bundles available for this number. Try airtime or another network.'
      );
      err.status = 422;
      throw err;
    }
    return {
      utilityType: 'data',
      countryCode: code,
      networkCode: network,
      denominationType: 'FIXED',
      fiatCurrency: catalog.fiatCurrency || currency,
      minFiatAmount: catalog.bundles[0]?.fiatAmount ?? null,
      maxFiatAmount: catalog.bundles[catalog.bundles.length - 1]?.fiatAmount ?? null,
      allowedAmounts: catalog.bundles.map((b) => b.fiatAmount),
      bundles: catalog.bundles,
      operatorId: catalog.operatorId,
      operatorName: catalog.operatorName,
      source,
      reloadlyMock: reloadlyClient.reloadlyIsMock(),
    };
  }

  const { operator, limits, source } = await resolveOperatorForPhone({
    countryCode: code,
    networkCode: network,
    recipientPhone,
    utilityType: 'airtime',
  });

  return {
    utilityType: 'airtime',
    countryCode: code,
    networkCode: network,
    ...limits,
    source,
    reloadlyMock: reloadlyClient.reloadlyIsMock(),
  };
}

export async function listNormalizedOperators(countryCode) {
  const code = String(countryCode || 'UG').trim().toUpperCase();
  const currency = countryService.getCurrencyForCountry(code);
  const ops = await loadCountryOperators(code);
  return ops.map((op) => ({
    ...extractOperatorLimits(op, currency),
    logoUrls: op.logoUrls || [],
  }));
}

export default {
  extractOperatorLimits,
  assertFiatAmountAllowed,
  resolveOperatorForPhone,
  getTopupLimits,
  listNormalizedOperators,
  operatorMatchesNetwork,
};
