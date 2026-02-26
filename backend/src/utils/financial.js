import config from '../config/index.js';

/**
 * Shared currency-conversion utilities.
 * [F-6 FIX] Single source of truth for fiat→UGX normalization,
 * replacing 4 duplicate implementations across the codebase.
 */

/**
 * Convert a fiat amount to its UGX equivalent using cross-rates from config.
 *
 * @param {number} amount - the fiat amount
 * @param {string} fiatCurrency - 'UGX', 'KES', or 'TZS'
 * @returns {number} UGX equivalent
 */
export function fiatToUgx(amount, fiatCurrency) {
  if (!amount) return 0;
  if (fiatCurrency === 'UGX' || !fiatCurrency) return amount;
  const rate = config.usdcFiatRates.UGX / (config.usdcFiatRates[fiatCurrency] || config.usdcFiatRates.UGX);
  return amount * rate;
}

/**
 * Get the multiplier to convert a fiat currency to UGX.
 *
 * @param {string} fiatCurrency - 'UGX', 'KES', or 'TZS'
 * @returns {number} multiplier (e.g., ~24.5 for KES→UGX)
 */
export function getFiatToUgxRate(fiatCurrency) {
  if (fiatCurrency === 'UGX' || !fiatCurrency) return 1;
  return config.usdcFiatRates.UGX / (config.usdcFiatRates[fiatCurrency] || config.usdcFiatRates.UGX);
}

/**
 * Determine which trader float column to use for a given fiat currency.
 *
 * @param {string} fiatCurrency - 'UGX', 'KES', or 'TZS'
 * @returns {string} column name: 'float_ugx', 'float_kes', or 'float_tzs'
 */
export function getFloatColumn(fiatCurrency) {
  if (fiatCurrency === 'KES') return 'float_kes';
  if (fiatCurrency === 'TZS') return 'float_tzs';
  return 'float_ugx';
}

export default { fiatToUgx, getFiatToUgxRate, getFloatColumn };
