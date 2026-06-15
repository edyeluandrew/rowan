/**
 * [PHASE 2H-4] Pluggable live fiat FX providers for USDC→local fiat reference rates.
 *
 * Rowan reference FX (not partner/trader spread — that layer comes later).
 * USDC is treated as ≈ USD for provider rates that quote USD base.
 *
 * CoinGecko: kept for crypto (XLM) pricing in quoteEngine only — its /simple/price
 * vs_currencies list does NOT include UGX or TZS (verified against API). Partial KES
 * responses are unreliable; do not use coingecko as the primary East Africa fiat path.
 */

export const VALID_FIAT = ['UGX', 'KES', 'TZS'];

const FETCH_TIMEOUT_MS = 15000;

function assertPositiveRate(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * ExchangeRate-API open endpoint — USD base, includes UGX/KES/TZS.
 * https://www.exchangerate-api.com/docs/free
 */
export async function fetchExchangeRateApi({ apiUrl, currencies }) {
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`exchange-rate-api HTTP ${res.status}`);
  const data = await res.json();
  if (data.result !== 'success' || !data.rates) {
    throw new Error(`exchange-rate-api bad payload: ${data.result || 'unknown'}`);
  }
  const providerUpdatedAtUnix = data.time_last_update_unix;
  if (!providerUpdatedAtUnix || !Number.isFinite(providerUpdatedAtUnix)) {
    throw new Error('exchange-rate-api missing time_last_update_unix');
  }
  const fetchedAt = new Date().toISOString();
  const providerUpdatedAt = new Date(providerUpdatedAtUnix * 1000).toISOString();
  const rates = {};
  for (const ccy of currencies) {
    const rate = assertPositiveRate(data.rates[ccy]);
    if (rate != null) {
      rates[ccy] = {
        rate,
        fiatRateSource: `exchange-rate-api:USD/${ccy}`,
      };
    }
  }
  return {
    provider: 'exchange-rate-api',
    fetchedAt,
    fetchedAtUnix: Math.floor(Date.now() / 1000),
    providerUpdatedAt,
    providerUpdatedAtUnix,
    rates,
  };
}

/**
 * CoinGecko USDC direct quotes — only currencies present in supported_vs_currencies.
 * Unsupported currencies are omitted (never substituted with USD).
 */
export async function fetchCoinGeckoFiat({ apiUrl, currencies }) {
  const supRes = await fetch(`${apiUrl}/simple/supported_vs_currencies`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!supRes.ok) throw new Error(`coingecko supported currencies HTTP ${supRes.status}`);
  const supported = await supRes.json();
  const supportedSet = new Set(
    (Array.isArray(supported) ? supported : []).map((s) => String(s).toLowerCase())
  );

  const quotable = currencies.filter((c) => supportedSet.has(c.toLowerCase()));
  if (quotable.length === 0) {
    return {
      provider: 'coingecko',
      fetchedAt: new Date().toISOString(),
      fetchedAtUnix: Math.floor(Date.now() / 1000),
      rates: {},
      unsupported: currencies,
    };
  }

  const vs = quotable.map((c) => c.toLowerCase()).join(',');
  const url = `${apiUrl}/simple/price?ids=usd-coin&vs_currencies=${vs}&include_last_updated_at=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`coingecko price HTTP ${res.status}`);
  const data = await res.json();
  const usdc = data?.['usd-coin'];
  if (!usdc) throw new Error('coingecko missing usd-coin price block');

  const lastUpdated = usdc.last_updated_at ? usdc.last_updated_at * 1000 : Date.now();
  const fetchedAt = new Date().toISOString();
  const providerUpdatedAt = new Date(lastUpdated).toISOString();

  const rates = {};
  for (const ccy of quotable) {
    const rate = assertPositiveRate(usdc[ccy.toLowerCase()]);
    if (rate != null) {
      rates[ccy] = {
        rate,
        fiatRateSource: `coingecko:usdc/${ccy}`,
      };
    }
  }

  const unsupported = currencies.filter((c) => !rates[c]);
  return { provider: 'coingecko', fetchedAt, fetchedAtUnix: Math.floor(Date.now() / 1000), providerUpdatedAt, rates, unsupported };
}

/** Dispatch to configured provider. Returns null when provider is disabled ('none'). */
export async function fetchLiveFiatBundle({ provider, apiUrl, currencies }) {
  if (!provider || provider === 'none') return null;
  if (provider === 'exchange-rate-api') {
    return fetchExchangeRateApi({ apiUrl, currencies });
  }
  if (provider === 'coingecko') {
    return fetchCoinGeckoFiat({ apiUrl, currencies });
  }
  throw new Error(`Unknown FIAT_FX_PROVIDER: ${provider}`);
}

export function describeProvider(provider) {
  if (provider === 'exchange-rate-api') {
    return 'ExchangeRate-API (USD base → UGX/KES/TZS; USDC≈USD reference)';
  }
  if (provider === 'coingecko') {
    return 'CoinGecko USDC quotes (partial fiat coverage — UGX/TZS not supported on free API)';
  }
  if (provider === 'none') return 'none (STATIC env/config fallback only)';
  return provider || 'unknown';
}
