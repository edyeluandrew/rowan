/**
 * Utility pricing — fiat amount → USDC debit (B6 input).
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

/**
 * Quote USDC cost for a fiat-denominated utility purchase.
 */
export async function quoteUtilityPurchase({ fiatAmount, fiatCurrency }) {
  const fiat = Number(fiatAmount);
  if (!Number.isFinite(fiat) || fiat <= 0) {
    const err = new Error('fiatAmount must be a positive number');
    err.status = 400;
    throw err;
  }

  const currency = String(fiatCurrency || 'UGX').toUpperCase();
  const fiatPerUsdc = await getFiatToUsdcRate(currency);
  const baseUsdc = fiat / fiatPerUsdc;
  const feeUsdc = baseUsdc * (config.utilities.feePercent / 100);
  const totalUsdc = baseUsdc + feeUsdc;

  return {
    fiatAmount: fiat,
    fiatCurrency: currency,
    fxRate: fiatPerUsdc,
    baseUsdc: roundUsdc(baseUsdc),
    platformFeeUsdc: roundUsdc(feeUsdc),
    totalUsdc: roundUsdc(totalUsdc),
    feePercent: config.utilities.feePercent,
  };
}

function roundUsdc(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}

export default { quoteUtilityPurchase, getFiatToUsdcRate };
