/**
 * Utility pricing — fiat amount → USDC debit.
 *
 * Airtime/data: face value only (no Rowan fee).
 * Bills/Yaka: MarzPay bill fee + Rowan 1% of token (min 200, max 2,000 UGX).
 */

import config from '../../config/index.js';
import fxService from '../fxService.js';

export async function getFiatToUsdcRate(fiatCurrency) {
  try {
    return await fxService.getUsdcToFiatRate(fiatCurrency);
  } catch {
    return config.usdcFiatRates[fiatCurrency] || config.usdcFiatRates.UGX;
  }
}

export function rowanBillFeeFiat(billAmount) {
  const n = Number(billAmount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const percent = Number(config.utilities.billFeePercent) / 100;
  const minFiat = Number(config.utilities.billFeeMinFiat);
  const maxFiat = Number(config.utilities.billFeeMaxFiat);
  return Math.min(maxFiat, Math.max(minFiat, Math.round(n * percent)));
}

export function billServiceFeeFiat(billAmount, marzPayFeeFiat = config.marzPay.billFeeFiat) {
  return Number(marzPayFeeFiat || 0) + rowanBillFeeFiat(billAmount);
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

function roundUsdc(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}

/**
 * Quote USDC cost for a fiat-denominated utility purchase.
 * extraFiat is added to the debit (service fees) without a second percentage.
 */
export async function quoteUtilityPurchase({
  fiatAmount,
  fiatCurrency,
  extraFiat = 0,
  platformFeeFiat = 0,
}) {
  const fiat = Number(fiatAmount);
  if (!Number.isFinite(fiat) || fiat <= 0) {
    const err = new Error('fiatAmount must be a positive number');
    err.status = 400;
    throw err;
  }

  const extra = Number(extraFiat) || 0;
  const platformFiat = Number(platformFeeFiat) || 0;
  const currency = String(fiatCurrency || 'UGX').toUpperCase();
  const fiatPerUsdc = await getFiatToUsdcRate(currency);
  const chargeableFiat = fiat + extra;
  const baseUsdc = chargeableFiat / fiatPerUsdc;
  const feeUsdc = platformFiat > 0 ? platformFiat / fiatPerUsdc : 0;
  const totalUsdc = chargeableFiat / fiatPerUsdc;

  return {
    fiatAmount: chargeableFiat,
    fiatCurrency: currency,
    fxRate: fiatPerUsdc,
    baseUsdc: roundUsdc(baseUsdc),
    platformFeeUsdc: roundUsdc(feeUsdc),
    totalUsdc: roundUsdc(totalUsdc),
    feePercent: 0,
    platformFeeFiat: platformFiat,
    extraFiat: extra,
  };
}

export default {
  quoteUtilityPurchase,
  getFiatToUsdcRate,
  rowanBillFeeFiat,
  billServiceFeeFiat,
  assertFiatAmountAllowed,
};
