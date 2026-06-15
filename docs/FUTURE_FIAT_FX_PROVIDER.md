# Future Live Fiat FX Provider Plan

**Status:** Design only — Phase 2F adds metadata seam, not live integration  
**Last updated:** Phase 2F (June 2026)

---

## 1. Recommended interface

```javascript
// backend/src/services/fxService.js (future)
async function getUsdcToFiat(currency) {
  // Returns: { rate, fxSource, fxCurrency, fxAgeSeconds, fxWarning, fxProvider, fiatRateSource }
}
```

- Single entry point for all USDC→fiat conversion (UGX, KES, TZS).
- `quoteEngine`, `financial.js`, fraud limits, and admin health call this only — never read `config.usdcFiatRates` directly.

## 2. Provider abstraction

```javascript
// fxProvider.js
export async function fetchLiveRate(currency) { /* OpenExchangeRates, Fixer, etc. */ }

// fxService.js orchestration
// 1. Try Redis cache
// 2. Try live provider
// 3. Optional FALLBACK to last-good cache or STATIC (env) with loud warning
// 4. UNAVAILABLE if no rate and production mainnet
```

Suggested providers (evaluate cost/latency/UGX coverage):

- Open Exchange Rates / Fixer.io (USD base → derive USDC≈USD)
- CurrencyLayer, ExchangeRate-API
- Local market data feeds for East Africa if available

## 3. Redis cache TTL

- **Suggested TTL:** 300 seconds (5 minutes) for live rates.
- **Cache key:** `fx:usdc:{currency}` with payload `{ rate, fetchedAt, provider }`.
- **Warm on startup:** optional background refresh every TTL/2.

## 4. Stale-rate cutoff

- **Suggested stale cutoff:** 3600 seconds (1 hour) — configurable via `FIAT_FX_STALE_SECONDS`.
- Beyond cutoff: mark `fxSource=FALLBACK`, set `fxWarning`, emit audit/monitor event.
- On **mainnet:** block new quotes if age > cutoff and no fresh fetch succeeded.

## 5. Fallback behavior

| Environment | Missing live | Stale cache | STATIC env |
|-------------|--------------|-------------|------------|
| Testnet/demo | FALLBACK → STATIC if allowed | FALLBACK + warning | STATIC + warning |
| Mainnet prod | UNAVAILABLE (block quotes) | FALLBACK only if last-good < cutoff; else block | Block unless `ALLOW_STATIC_FIAT_RATES=true` (emergency only) |

Never label STATIC or stale cache as `LIVE`.

## 6. Production blocking behavior

- `assertFiatFxAvailableForQuote()` already blocks `UNAVAILABLE` and mainnet `STATIC` (unless explicitly allowed).
- Extend to block when `fxAgeSeconds > fiatFxStaleSeconds` on mainnet.
- Return HTTP 503 with code `FIAT_FX_STALE` or `FIAT_FX_UNAVAILABLE`.

## 7. Audit / monitoring events

Emit on:

- `fx_fetch_success` — currency, provider, rate, latency_ms
- `fx_fetch_failure` — currency, provider, error
- `fx_stale_rate_used` — currency, age_seconds
- `fx_quote_blocked` — currency, reason (unavailable/stale/static)

Surface in admin health and optional Datadog/Sentry alerts when mainnet quotes blocked > N minutes.

## 8. Admin health display requirements

`/api/v1/admin/system/health` and `/api/v1/admin/rates` should show:

- Per-currency: `fx_source`, `fx_rate`, `fiat_rate_source`, `fx_age_seconds`, `fx_warning`
- Global: `fx_provider`, `allow_static_fiat_rates`
- Include fiat FX warnings in `warningLevel` (testnet STATIC → WARNING; mainnet STATIC → CRITICAL)

---

**Phase 2F implementation:** `fxService.js` returns `STATIC` from env/config with full metadata. Live provider plugs in behind the same interface without quote math changes.
