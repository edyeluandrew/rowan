/**
 * Cap trader USDC prices against live mid-market FX (ExchangeRate-API).
 * Default ±3% so 1 USDC = 4000 UGX is rejected when market is ~3720.
 */

import config from '../config/index.js';
import fxService from './fxService.js';

function getBandPercents() {
  const maxPremiumPercent = Number(config.platform.p2pRateMaxPremiumPercent);
  const maxDiscountPercent = Number(config.platform.p2pRateMaxDiscountPercent);
  return {
    maxPremiumPercent: Number.isFinite(maxPremiumPercent) && maxPremiumPercent >= 0 ? maxPremiumPercent : 3,
    maxDiscountPercent: Number.isFinite(maxDiscountPercent) && maxDiscountPercent >= 0 ? maxDiscountPercent : 3,
  };
}

function roundLimit(value, currency, edge) {
  const ccy = String(currency || '').toUpperCase();
  if (ccy === 'KES') {
    return edge === 'min'
      ? Math.floor(value * 100) / 100
      : Math.ceil(value * 100) / 100;
  }
  return edge === 'min' ? Math.floor(value) : Math.ceil(value);
}

function formatRate(value, currency) {
  const digits = String(currency || '').toUpperCase() === 'KES' ? 2 : 0;
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function buildBand(marketRate, currency, percents = getBandPercents()) {
  const market = Number(marketRate);
  if (!Number.isFinite(market) || market <= 0) return null;
  return {
    currency: String(currency || '').toUpperCase(),
    marketRate: market,
    minRate: roundLimit(market * (1 - percents.maxDiscountPercent / 100), currency, 'min'),
    maxRate: roundLimit(market * (1 + percents.maxPremiumPercent / 100), currency, 'max'),
    maxPremiumPercent: percents.maxPremiumPercent,
    maxDiscountPercent: percents.maxDiscountPercent,
  };
}

export function isWithinBand(rate, band) {
  const n = Number(rate);
  if (!band || !Number.isFinite(n) || n <= 0) return false;
  return n >= band.minRate && n <= band.maxRate;
}

export async function getBandForCurrency(currency) {
  const fx = await fxService.getUsdcToFiat(currency);
  if (fx?.rate == null || !Number.isFinite(Number(fx.rate)) || Number(fx.rate) <= 0) {
    return null;
  }
  return buildBand(fx.rate, currency);
}

function outOfBandError(rate, band, { forUser = false } = {}) {
  const err = new Error(
    forUser
      ? `This trader's USDC price is outside the market range (${formatRate(band.minRate, band.currency)}–${formatRate(band.maxRate, band.currency)} ${band.currency}). Pick another ad.`
      : `USDC price must be between ${formatRate(band.minRate, band.currency)} and ${formatRate(band.maxRate, band.currency)} ${band.currency} (market ${formatRate(band.marketRate, band.currency)} ±${band.maxPremiumPercent}%).`
  );
  err.statusCode = forUser ? 409 : 400;
  err.status = err.statusCode;
  err.code = 'RATE_OUTSIDE_MARKET_BAND';
  err.details = { rate: Number(rate), ...band };
  return err;
}

/** Hard reject when a trader saves an ad. Requires a usable market rate. */
export async function assertRateWithinMarketBand(ratePerUsdc, currency) {
  const rate = Number(ratePerUsdc);
  if (!Number.isFinite(rate) || rate <= 0) {
    const err = new Error('rate_per_usdc is required (fiat per 1 USDC)');
    err.statusCode = 400;
    err.status = 400;
    throw err;
  }

  const band = await getBandForCurrency(currency);
  if (!band) {
    const err = new Error('Market rate is unavailable. Try again in a moment.');
    err.statusCode = 503;
    err.status = 503;
    err.code = 'FIAT_FX_UNAVAILABLE';
    throw err;
  }

  if (!isWithinBand(rate, band)) {
    throw outOfBandError(rate, band);
  }
  return band;
}

/**
 * Quote-time check for an already posted rate.
 * If FX is down, do not freeze the order — listing already filtered when FX was up.
 */
export async function assertPostedRateWithinBand(ratePerUsdc, currency) {
  const rate = Number(ratePerUsdc);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const band = await getBandForCurrency(currency);
  if (!band) return null;
  if (!isWithinBand(rate, band)) {
    throw outOfBandError(rate, band, { forUser: true });
  }
  return band;
}

/** Drop posted rates outside the live band. Keep unpriced ads. If FX is down, keep all. */
export async function filterAdsByMarketBand(ads) {
  if (!Array.isArray(ads) || ads.length === 0) return ads;
  const bands = new Map();
  const out = [];
  for (const ad of ads) {
    const rate = ad.ratePerUsdc != null ? Number(ad.ratePerUsdc) : null;
    if (rate == null || !Number.isFinite(rate) || rate <= 0) {
      out.push(ad);
      continue;
    }
    const ccy = ad.currency;
    if (!bands.has(ccy)) {
      bands.set(ccy, await getBandForCurrency(ccy));
    }
    const band = bands.get(ccy);
    if (!band || isWithinBand(rate, band)) out.push(ad);
  }
  return out;
}

export default {
  getBandPercents,
  buildBand,
  isWithinBand,
  getBandForCurrency,
  assertRateWithinMarketBand,
  assertPostedRateWithinBand,
  filterAdsByMarketBand,
};
