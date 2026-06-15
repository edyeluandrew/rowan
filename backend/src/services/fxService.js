import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * [PHASE 2F] Fiat FX seam — today reads STATIC env/config rates only.
 * Future: plug a live provider behind getUsdcToFiat() without changing quoteEngine.
 *
 * fx_source values:
 *   STATIC       — USDC_RATE_* env or config.usdcFiatRates defaults
 *   LIVE         — reserved for future live FX provider
 *   FALLBACK     — reserved for stale-cache / provider-failure fallback
 *   UNAVAILABLE  — no rate configured (blocks quotes on mainnet)
 */

const VALID_FIAT = ['UGX', 'KES', 'TZS'];
const bootTime = Date.now();

function envKeyFor(currency) {
  return `USDC_RATE_${currency}`;
}

function rateFromConfig(currency) {
  const fromEnv = process.env[envKeyFor(currency)];
  if (fromEnv != null && fromEnv !== '') {
    const n = parseFloat(fromEnv);
    if (Number.isFinite(n) && n > 0) return { rate: n, source: `env:${envKeyFor(currency)}` };
  }
  const fromConfig = config.usdcFiatRates?.[currency];
  if (fromConfig != null && Number.isFinite(fromConfig) && fromConfig > 0) {
    return { rate: fromConfig, source: 'config:usdcFiatRates' };
  }
  return null;
}

/**
 * Resolve USDC→fiat rate + metadata for a currency.
 * Does not throw — returns UNAVAILABLE when rate missing.
 */
export function getUsdcToFiat(currency = 'UGX') {
  const fxCurrency = (currency || 'UGX').toUpperCase();
  const resolved = rateFromConfig(fxCurrency);

  if (!resolved) {
    return {
      rate: null,
      fxSource: 'UNAVAILABLE',
      fxCurrency,
      fxAgeSeconds: null,
      fxWarning: `No USDC→${fxCurrency} rate configured. Set ${envKeyFor(fxCurrency)} or config.usdcFiatRates.`,
      fxProvider: null,
      fiatRateSource: 'unavailable',
    };
  }

  const fxSource = 'STATIC'; // only STATIC until a live provider is wired
  const fxAgeSeconds = Math.floor((Date.now() - bootTime) / 1000);
  let fxWarning = null;

  if (config.stellar.isMainnet) {
    if (!config.platform.allowStaticFiatRates) {
      fxWarning = 'Fiat FX uses STATIC configured rates on mainnet — live FX provider required for production.';
    } else {
      fxWarning = 'Fiat FX uses STATIC configured rates (ALLOW_STATIC_FIAT_RATES=true). Not a live market rate.';
    }
  } else if (config.nodeEnv === 'production') {
    fxWarning = 'Fiat FX uses STATIC env rates (testnet/demo). Not a live market rate.';
  }

  return {
    rate: resolved.rate,
    fxSource,
    fxCurrency,
    fxAgeSeconds,
    fxWarning,
    fxProvider: 'static-config',
    fiatRateSource: resolved.source,
  };
}

/** Backward-compatible numeric rate (falls back to UGX default like quoteEngine did). */
export function getUsdcToFiatRate(currency = 'UGX') {
  const fx = getUsdcToFiat(currency);
  if (fx.rate != null) return fx.rate;
  const ugx = getUsdcToFiat('UGX');
  return ugx.rate ?? config.usdcFiatRates.UGX;
}

/**
 * Gate quote creation when fiat FX is unsafe.
 * @throws Error with statusCode 503 when blocked
 */
export function assertFiatFxAvailableForQuote(currency) {
  const fx = getUsdcToFiat(currency);
  if (fx.fxSource === 'UNAVAILABLE') {
    const err = new Error(`Quote temporarily unavailable: fiat FX rate for ${fx.fxCurrency} is not configured.`);
    err.statusCode = 503;
    err.code = 'FIAT_FX_UNAVAILABLE';
    throw err;
  }
  if (config.stellar.isMainnet && !config.platform.allowStaticFiatRates && fx.fxSource === 'STATIC') {
    const err = new Error('Quote temporarily unavailable: live fiat FX is required on mainnet. Configure a live FX provider or set ALLOW_STATIC_FIAT_RATES=true for controlled environments only.');
    err.statusCode = 503;
    err.code = 'FIAT_FX_STATIC_BLOCKED';
    throw err;
  }
  return fx;
}

/** Health/admin snapshot for all supported fiat currencies. */
export function getFiatFxHealth() {
  const currencies = {};
  const warnings = [];
  const criticals = [];

  for (const ccy of VALID_FIAT) {
    currencies[ccy] = getUsdcToFiat(ccy);
  }

  const anyUnavailable = VALID_FIAT.some((c) => currencies[c].fxSource === 'UNAVAILABLE');
  const allStatic = VALID_FIAT.every((c) => currencies[c].fxSource === 'STATIC');

  if (anyUnavailable) {
    criticals.push('One or more fiat FX rates (UGX/KES/TZS) are UNAVAILABLE');
  }
  if (config.stellar.isMainnet && allStatic && !config.platform.allowStaticFiatRates) {
    criticals.push('Mainnet requires live fiat FX — all rates are STATIC');
  } else if (allStatic) {
    warnings.push('Fiat FX uses STATIC env/config rates (not live market FX)');
  }

  const primary = currencies.UGX;
  return {
    fx_source: primary.fxSource,
    fx_provider: primary.fxProvider,
    allow_static_fiat_rates: config.platform.allowStaticFiatRates,
    currencies,
    warnings,
    criticals,
  };
}

export default { getUsdcToFiat, getUsdcToFiatRate, assertFiatFxAvailableForQuote, getFiatFxHealth, VALID_FIAT };
