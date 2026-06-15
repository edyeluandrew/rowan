import config from '../config/index.js';
import redis from '../db/redis.js';
import logger from '../utils/logger.js';
import {
  VALID_FIAT,
  fetchLiveFiatBundle,
  describeProvider,
} from './fx/fxProviders.js';

/**
 * [PHASE 2H-4] Fiat FX orchestration — live provider + cache + STATIC testnet fallback.
 *
 * Rowan reference/base rate for USDC→fiat (UGX/KES/TZS). Partner spread/margin is
 * applied later via admin-approved rules — not in this phase.
 *
 * fxSource values:
 *   LIVE         — fresh live provider rate (or fresh cached live within max age)
 *   STATIC       — env/config fallback (testnet/demo only unless explicitly allowed)
 *   FALLBACK     — stale cached live rate (explicit warning; blocked on mainnet by default)
 *   UNAVAILABLE  — no usable rate (blocks quotes on mainnet)
 */

const REDIS_BUNDLE_KEY = 'fx:usdc:bundle';
let memoryBundle = null;
let refreshInFlight = null;
let testProviderOverride = null;

function envKeyFor(currency) {
  return `USDC_RATE_${currency}`;
}

function rateFromConfig(currency) {
  const fromEnv = process.env[envKeyFor(currency)];
  if (fromEnv != null && fromEnv !== '') {
    const n = parseFloat(fromEnv);
    if (Number.isFinite(n) && n > 0) return { rate: n, source: `env:${envKeyFor(currency)}` };
  }
  const fromConfig = config.fiatFx.staticRates?.[currency];
  if (fromConfig != null && Number.isFinite(fromConfig) && fromConfig > 0) {
    return { rate: fromConfig, source: 'config:usdcFiatRates' };
  }
  return null;
}

function ageSecondsFrom(fetchedAtIso) {
  if (!fetchedAtIso) return null;
  const t = Date.parse(fetchedAtIso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

function normalizeFxResult({
  rate,
  fxSource,
  fxCurrency,
  fxProvider,
  fiatRateSource,
  fxFetchedAt,
  fxWarning = null,
}) {
  const fxAgeSeconds = ageSecondsFrom(fxFetchedAt);
  return {
    rate,
    fxSource,
    fxCurrency,
    fxProvider,
    fiatRateSource,
    fxFetchedAt: fxFetchedAt || null,
    fxAgeSeconds,
    fxWarning,
  };
}

function staticFx(currency, warningExtra = null) {
  const resolved = rateFromConfig(currency);
  if (!resolved) {
    return normalizeFxResult({
      rate: null,
      fxSource: 'UNAVAILABLE',
      fxCurrency: currency,
      fxProvider: 'static-config',
      fiatRateSource: 'unavailable',
      fxFetchedAt: null,
      fxWarning: `No USDC→${currency} rate configured. Set ${envKeyFor(currency)} or config.usdcFiatRates.`,
    });
  }

  let fxWarning = warningExtra;
  if (!fxWarning) {
    if (config.stellar.isMainnet) {
      fxWarning = config.platform.allowStaticFiatRates
        ? 'Fiat FX uses STATIC configured rates (ALLOW_STATIC_FIAT_RATES=true). Not a live market rate.'
        : 'Fiat FX uses STATIC configured rates on mainnet — live FX provider required for production.';
    } else {
      fxWarning = 'Fiat FX uses STATIC env rates (testnet/demo). Not a live market rate.';
    }
  }

  return normalizeFxResult({
    rate: resolved.rate,
    fxSource: 'STATIC',
    fxCurrency: currency,
    fxProvider: 'static-config',
    fiatRateSource: resolved.source,
    fxFetchedAt: null,
    fxWarning,
  });
}

function liveFx(currency, entry, bundle) {
  let fxWarning = null;
  if (bundle.providerUpdatedAt) {
    const providerAge = ageSecondsFrom(bundle.providerUpdatedAt);
    if (providerAge != null && providerAge > config.fiatFx.maxAgeSeconds) {
      fxWarning = `Provider rate data last updated ${providerAge}s ago (${bundle.providerUpdatedAt}). Rowan cache fetch is fresh.`;
    }
  }
  return normalizeFxResult({
    rate: entry.rate,
    fxSource: 'LIVE',
    fxCurrency: currency,
    fxProvider: bundle.provider,
    fiatRateSource: entry.fiatRateSource,
    fxFetchedAt: bundle.fetchedAt,
    fxWarning,
  });
}

function fallbackFx(currency, entry, bundle, reason) {
  return normalizeFxResult({
    rate: entry.rate,
    fxSource: 'FALLBACK',
    fxCurrency: currency,
    fxProvider: bundle.provider,
    fiatRateSource: entry.fiatRateSource,
    fxFetchedAt: bundle.fetchedAt,
    fxWarning: reason,
  });
}

function memoryCacheFresh() {
  if (!memoryBundle?.fetchedAt) return false;
  const age = ageSecondsFrom(memoryBundle.fetchedAt);
  return age != null && age <= config.fiatFx.cacheTtlSeconds;
}

async function readRedisBundle() {
  if (redis.status !== 'ready') return null;
  try {
    const raw = await Promise.race([
      redis.get(REDIS_BUNDLE_KEY),
      new Promise((_, reject) => setTimeout(() => reject(new Error('redis read timeout')), 2000)),
    ]);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    logger.warn('[FxService] Redis bundle read failed:', e.message);
    return null;
  }
}

async function writeRedisBundle(bundle) {
  if (redis.status !== 'ready') return;
  try {
    await Promise.race([
      redis.set(
        REDIS_BUNDLE_KEY,
        JSON.stringify(bundle),
        'EX',
        config.fiatFx.maxAgeSeconds + 300,
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('redis write timeout')), 2000)),
    ]);
  } catch (e) {
    logger.warn('[FxService] Redis bundle write failed:', e.message);
  }
}

function applyBundle(bundle) {
  memoryBundle = bundle;
}

async function fetchAndStoreBundle() {
  const fetcher = testProviderOverride
    || ((opts) => fetchLiveFiatBundle(opts));

  const bundle = await fetcher({
    provider: config.fiatFx.provider,
    apiUrl: config.fiatFx.apiUrl,
    currencies: VALID_FIAT,
  });

  if (!bundle) return null;

  applyBundle(bundle);
  await writeRedisBundle(bundle);
  logger.info(`[FxService] Live FX bundle refreshed (${bundle.provider}, currencies=${Object.keys(bundle.rates || {}).join(',')})`);
  return bundle;
}

/** Force or refresh live rate bundle from provider. */
export async function refreshFiatFxRates() {
  if (!config.fiatFx.enabled) return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      return await fetchAndStoreBundle();
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function ensureBundle() {
  if (memoryCacheFresh()) return memoryBundle;
  if (!config.fiatFx.enabled) return null;

  try {
    const refreshed = await refreshFiatFxRates();
    if (refreshed) return refreshed;
  } catch (e) {
    logger.warn('[FxService] Live FX fetch failed:', e.message);
  }

  if (memoryBundle) return memoryBundle;

  const fromRedis = await readRedisBundle();
  if (fromRedis) {
    applyBundle(fromRedis);
    return fromRedis;
  }

  return null;
}

function resolveFromBundle(currency) {
  const bundle = memoryBundle;
  if (!bundle?.rates?.[currency]) return null;

  const entry = bundle.rates[currency];
  const age = ageSecondsFrom(bundle.fetchedAt);
  const maxAge = config.fiatFx.maxAgeSeconds;

  if (age != null && age <= maxAge) {
    return liveFx(currency, entry, bundle);
  }

  if (config.fiatFx.allowStaleRates) {
    return fallbackFx(
      currency,
      entry,
      bundle,
      `Fiat FX rate is stale (${age}s old, max ${maxAge}s). Using last-known rate (ALLOW_STALE_FX_RATES=true).`,
    );
  }

  if (config.platform.allowStaticFiatRates) {
    return staticFx(
      currency,
      `Live fiat FX stale/unavailable (${age != null ? `${age}s` : 'unknown age'}). Using STATIC fallback.`,
    );
  }

  return normalizeFxResult({
    rate: null,
    fxSource: 'UNAVAILABLE',
    fxCurrency: currency,
    fxProvider: bundle.provider,
    fiatRateSource: 'stale-live-cache',
    fxFetchedAt: bundle.fetchedAt,
    fxWarning: `Fiat FX rate for ${currency} is stale (${age}s) and stale fallback is disabled.`,
  });
}

/**
 * Resolve USDC→fiat rate + metadata for a currency.
 * Does not throw — returns UNAVAILABLE when no safe rate exists.
 */
export async function getUsdcToFiat(currency = 'UGX') {
  const fxCurrency = (currency || 'UGX').toUpperCase();

  if (!VALID_FIAT.includes(fxCurrency)) {
    return normalizeFxResult({
      rate: null,
      fxSource: 'UNAVAILABLE',
      fxCurrency,
      fxProvider: null,
      fiatRateSource: 'unsupported-currency',
      fxFetchedAt: null,
      fxWarning: `Unsupported fiat currency ${fxCurrency}. Supported: ${VALID_FIAT.join(', ')}.`,
    });
  }

  if (config.fiatFx.enabled) {
    await ensureBundle();
    const fromBundle = resolveFromBundle(fxCurrency);
    if (fromBundle && fromBundle.fxSource !== 'UNAVAILABLE') return fromBundle;

    if (fromBundle?.fxSource === 'UNAVAILABLE') return fromBundle;
  }

  if (config.platform.allowStaticFiatRates) {
    return staticFx(fxCurrency);
  }

  return normalizeFxResult({
    rate: null,
    fxSource: 'UNAVAILABLE',
    fxCurrency,
    fxProvider: config.fiatFx.enabled ? config.fiatFx.provider : null,
    fiatRateSource: 'live-provider-required',
    fxFetchedAt: null,
    fxWarning: 'Live fiat FX unavailable and STATIC fallback is disabled.',
  });
}

/** Numeric rate helper — falls back to UGX static default only when unavoidable. */
export async function getUsdcToFiatRate(currency = 'UGX') {
  const fx = await getUsdcToFiat(currency);
  if (fx.rate != null) return fx.rate;
  const ugx = await getUsdcToFiat('UGX');
  return ugx.rate ?? config.fiatFx.staticRates.UGX;
}

/**
 * Gate quote creation when fiat FX is unsafe.
 * @throws Error with statusCode 503 when blocked
 */
export async function assertFiatFxAvailableForQuote(currency) {
  const fx = await getUsdcToFiat(currency);

  if (fx.fxSource === 'UNAVAILABLE' || fx.rate == null) {
    const err = new Error(`Quote temporarily unavailable: fiat FX rate for ${fx.fxCurrency} is not available.`);
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

  if (config.stellar.isMainnet && fx.fxSource === 'FALLBACK') {
    const err = new Error('Quote temporarily unavailable: fiat FX rate is stale. Refresh live FX or set ALLOW_STALE_FX_RATES=true for controlled environments only.');
    err.statusCode = 503;
    err.code = 'FIAT_FX_STALE';
    throw err;
  }

  const maxAge = config.fiatFx.maxAgeSeconds;
  if (
    config.stellar.isMainnet
    && fx.fxSource === 'LIVE'
    && fx.fxAgeSeconds != null
    && fx.fxAgeSeconds > maxAge
  ) {
    const err = new Error(`Quote temporarily unavailable: fiat FX rate is older than ${maxAge}s.`);
    err.statusCode = 503;
    err.code = 'FIAT_FX_STALE';
    throw err;
  }

  return fx;
}

/** Health/admin snapshot for all supported fiat currencies. */
export async function getFiatFxHealth() {
  const currencies = {};
  const warnings = [];
  const criticals = [];

  if (config.fiatFx.enabled) {
    try {
      await ensureBundle();
    } catch (e) {
      warnings.push(`Live FX refresh failed: ${e.message}`);
    }
  }

  for (const ccy of VALID_FIAT) {
    currencies[ccy] = await getUsdcToFiat(ccy);
  }

  const anyUnavailable = VALID_FIAT.some((c) => currencies[c].fxSource === 'UNAVAILABLE');
  const allStatic = VALID_FIAT.every((c) => currencies[c].fxSource === 'STATIC');
  const allLive = VALID_FIAT.every((c) => currencies[c].fxSource === 'LIVE');
  const anyFallback = VALID_FIAT.some((c) => currencies[c].fxSource === 'FALLBACK');
  const partialLive = VALID_FIAT.some((c) => currencies[c].fxSource === 'LIVE')
    && VALID_FIAT.some((c) => currencies[c].fxSource !== 'LIVE');

  if (anyUnavailable) {
    const msg = 'One or more fiat FX rates (UGX/KES/TZS) are UNAVAILABLE';
    if (config.stellar.isMainnet) criticals.push(msg);
    else warnings.push(msg);
  }

  if (config.stellar.isMainnet && allStatic && !config.platform.allowStaticFiatRates) {
    criticals.push('Mainnet requires live fiat FX — all rates are STATIC');
  } else if (allStatic) {
    warnings.push('Fiat FX uses STATIC env/config rates (not live market FX)');
  }

  if (config.stellar.isMainnet && anyFallback) {
    criticals.push('Mainnet has stale FALLBACK fiat FX rates');
  } else if (anyFallback) {
    warnings.push('Fiat FX using stale FALLBACK rates for one or more currencies');
  }

  if (partialLive) {
    const msg = 'Fiat FX provider partially covers UGX/KES/TZS — some currencies not LIVE';
    if (config.stellar.isMainnet) criticals.push(msg);
    else warnings.push(msg);
  }

  if (allLive) {
    const staleLive = VALID_FIAT.filter(
      (c) => currencies[c].fxAgeSeconds != null && currencies[c].fxAgeSeconds > config.fiatFx.maxAgeSeconds,
    );
    if (staleLive.length > 0) {
      const msg = `Live fiat FX exceeds max age for: ${staleLive.join(', ')}`;
      if (config.stellar.isMainnet) criticals.push(msg);
      else warnings.push(msg);
    }
  }

  const primary = currencies.UGX;
  return {
    fx_source: primary.fxSource,
    fx_provider: primary.fxProvider,
    configured_provider: config.fiatFx.provider,
    provider_description: describeProvider(config.fiatFx.provider),
    coingecko_api_url: config.coingeckoApiUrl,
    coingecko_role: 'crypto-xlm-fallback-only',
    live_fx_enabled: config.fiatFx.enabled,
    allow_static_fiat_rates: config.platform.allowStaticFiatRates,
    allow_stale_fx_rates: config.fiatFx.allowStaleRates,
    cache_ttl_seconds: config.fiatFx.cacheTtlSeconds,
    max_age_seconds: config.fiatFx.maxAgeSeconds,
    bundle_fetched_at: memoryBundle?.fetchedAt || null,
    provider_rate_updated_at: memoryBundle?.providerUpdatedAt || null,
    currencies,
    warnings,
    criticals,
  };
}

/** @internal test hook — inject mock provider fetcher */
export function __testSetProviderOverride(fn) {
  testProviderOverride = fn;
}

/** @internal test hook — reset caches */
export function __testResetFxState() {
  memoryBundle = null;
  refreshInFlight = null;
  testProviderOverride = null;
}

export default {
  getUsdcToFiat,
  getUsdcToFiatRate,
  assertFiatFxAvailableForQuote,
  getFiatFxHealth,
  refreshFiatFxRates,
  VALID_FIAT,
  __testSetProviderOverride,
  __testResetFxState,
};
