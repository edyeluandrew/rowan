# Live Fiat FX Provider — Phase 2H-4 (Implemented)

**Status:** Implemented on testnet (June 2026)  
**Provider default:** `exchange-rate-api` (USD base → UGX/KES/TZS; USDC≈USD reference)

---

## 1. Interface

```javascript
// backend/src/services/fxService.js
await getUsdcToFiat(currency) → {
  rate,
  fxSource,       // LIVE | STATIC | FALLBACK | UNAVAILABLE
  fxProvider,
  fxCurrency,
  fxAgeSeconds,
  fxFetchedAt,
  fxWarning,
  fiatRateSource,
}
```

- Single entry point for USDC→fiat reference rates (UGX, KES, TZS).
- `quoteEngine`, admin health, and public rates call this — not `config.usdcFiatRates` directly for quotes.
- Partner/trader spread is **not** applied here; live FX is Rowan’s reference/base rate. Admin-approved partner margins can be layered later.

## 2. Provider abstraction

| Provider | Role | UGX/KES/TZS |
|----------|------|-------------|
| `exchange-rate-api` | **Default live fiat FX** | All three via USD base |
| `coingecko` | Optional adapter | **Partial** — UGX/TZS not in CoinGecko `supported_vs_currencies`; not suitable as primary East Africa path |
| `none` | STATIC-only (testnet) | Falls back to env/config |

**CoinGecko (existing config):** remains in `quoteEngine.getLegacyXlmRate()` for **XLM crypto** fallback only (`stellar` vs fiat). Verified: CoinGecko free API does not list UGX or TZS as `vs_currencies`; do not use for USDC→UGX/TZS.

Orchestration (`fxService.js`):

1. Try live provider fetch (batched bundle)
2. Redis + in-memory cache (`fx:usdc:bundle`)
3. On provider failure: use cached LIVE if age ≤ `FX_RATE_MAX_AGE_SECONDS`
4. If stale: `FALLBACK` (if `ALLOW_STALE_FX_RATES`) or STATIC (testnet) or `UNAVAILABLE`
5. Never label STATIC or stale cache as `LIVE`

## 3. Cache TTL

- **`FX_RATE_CACHE_TTL_SECONDS`** (default 300): re-fetch interval
- Redis key: `fx:usdc:bundle` with `{ provider, fetchedAt, rates: { UGX, KES, TZS } }`

## 4. Stale-rate cutoff

- **`FX_RATE_MAX_AGE_SECONDS`** / `FIAT_FX_STALE_SECONDS` (default 3600)
- Beyond cutoff on mainnet: block quotes (`FIAT_FX_STALE`) unless `ALLOW_STALE_FX_RATES=true` (emergency only)

## 5. Fallback behavior

| Environment | Provider down + fresh cache | Stale cache | STATIC env |
|-------------|----------------------------|-------------|------------|
| Testnet/demo | LIVE (cached) | FALLBACK/STATIC + warning | STATIC + warning |
| Mainnet prod | LIVE (cached if fresh) | Block / CRITICAL | Block unless `ALLOW_STATIC_FIAT_RATES=true` |

## 6. Production blocking

- `assertFiatFxAvailableForQuote()` blocks: `UNAVAILABLE`, mainnet `STATIC`, mainnet `FALLBACK`, mainnet age > max
- HTTP 503 codes: `FIAT_FX_UNAVAILABLE`, `FIAT_FX_STATIC_BLOCKED`, `FIAT_FX_STALE`

## 7. Quote + DB metadata

Quotes store: `fx_source`, `fx_rate`, `fx_currency`, `fx_warning`, `fiat_rate_source`, `fx_provider`, `fx_fetched_at`, `fx_age_seconds` (migration 029).

## 8. Admin health

`/api/v1/admin/system/health` and `/api/v1/admin/rates` expose per-currency source, rate, age, `fx_fetched_at`, provider, warnings.

- Testnet STATIC only → `WARNING`
- All currencies LIVE + fresh → `OK` (if no other issues)
- Mainnet stale/unavailable → `CRITICAL`

## 9. Runtime tests

`node backend/scripts/phase2h4-runtime-tests.mjs` — Tests A–F (provider config, live fetch, quote metadata, failure modes, health, mainnet safety sim).

---

**Pilot readiness:** LIVE fresh fiat FX is **required** before real-money pilot. STATIC is testnet/demo only. Monitor provider freshness and rate-limit failures.
