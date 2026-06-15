# Health and Rates Monitoring Runbook

**When to use:** Daily ops, pre-demo checks, incident triage.

---

## Public health

```http
GET /health
```

No auth. Returns:

```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected",
  "horizon": "connected",
  "uptime": 12345
}
```

503 if critical dependency down.

---

## Admin system health

```http
GET /api/v1/admin/system/health
Authorization: Bearer <admin token>
```

Top-level: `status` (`healthy` | `warning` | `degraded`), `uptime`, `db`, `memory`, `liquidity`, `timestamp`.

### Liquidity section (key fields)

| Field | Meaning |
|-------|---------|
| `liquidity.network` | `testnet` or `mainnet` |
| `liquidity.horizon.reachable` | Horizon API up |
| `liquidity.escrow.xlm_balance` / `usdc_balance` | Escrow balances |
| `liquidity.escrow.usdc_trustline` | Escrow can hold USDC |
| `liquidity.marketMaker.configured` | MM keys present |
| `liquidity.pathDiscovery.available` | Live path for XLM→USDC |
| `liquidity.quoteSource` | `LIVE` or `FALLBACK` |
| `liquidity.fiatFx.fx_source` | e.g. `STATIC` on testnet |
| `liquidity.pending.*` | Pipeline counts (see below) |
| `liquidity.warningLevel` | `OK` \| `WARNING` \| `CRITICAL` |
| `liquidity.warnings[]` / `criticals[]` | Human-readable issues |

### Pending pipeline counts

| Key | Concern if > 0 |
|-----|----------------|
| `dispute_refund_pending` | User refunds stuck |
| `dispute_release_pending` | Trader releases in progress |
| `release_blocked` | **CRITICAL** — trustline/release failures |
| `refund_errors` | Failed refund attempts |
| `stuck_escrow_locked` | Matching/deposit issues |
| `stuck_refund_pending` | Refund queue stuck |
| `stuck_release_pending` | Release queue stuck |
| `recent_failed` | Recent FAILED transactions |

Threshold env vars: `HEALTH_ESCROW_USDC_WARN`, `HEALTH_ESCROW_XLM_CRIT`, `HEALTH_ESCROW_XLM_WARN`, `HEALTH_STUCK_MINUTES`.

---

## Admin rates

```http
GET /api/v1/admin/rates
Authorization: Bearer <admin token>
```

Summary fields: `quote_source`, `path_discovery_available`, `fallback_quotes_allowed`, `market_maker_configured`, `escrow_usdc_balance`, `escrow_xlm_balance`, `pending_refunds`, `release_blocked`, `recent_failed`, `liquidity_warning_level`, `liquidity_warnings[]`, `fiat_fx`, `updated_at`.

Patch wholesale rate (admin only):

```http
PATCH /api/v1/admin/rates
{ "wholesale_rate_ugx": 1234.56 }
```

---

## warningLevel meanings

| Level | Meaning | Typical testnet cause |
|-------|---------|------------------------|
| **OK** | No actionable issues | Healthy demo |
| **WARNING** | Degraded but operable | **STATIC fiat FX** (expected on testnet), low escrow warning thresholds |
| **CRITICAL** | Settlement risk | `release_blocked > 0`, escrow XLM critically low, Horizon down |

### Why STATIC fiat FX causes WARNING

Testnet uses env-based static USDC/fiat rates (`allowStaticFiatRates` true on testnet). Health correctly flags this as non-live FX — **expected for demos**, not a blocker.

**Do not confuse with pilot readiness** — real-money pilots need live FX ([FUTURE_FIAT_FX_PROVIDER.md](../FUTURE_FIAT_FX_PROVIDER.md)).

---

## quoteSource = LIVE vs FALLBACK

| Value | Meaning | Action |
|-------|---------|--------|
| **LIVE** | Path discovery succeeded; quotes use live orderbook | Normal |
| **FALLBACK** | Using fallback quote path | **Investigate immediately** — check MM offers, Horizon, `pathDiscovery.available` |

On mainnet, `ALLOW_FALLBACK_QUOTES` must be `false` (see [Mainnet Cutover](./MAINNET_CUTOVER_CHECKLIST.md)).

---

## Market maker not configured

If `market_maker_configured = false`:

- Path discovery may fail → FALLBACK quotes
- Swaps may not execute

**Action:** Configure `MARKET_MAKER_PUBLIC_KEY` / secret, fund account, set up offers (`backend/scripts/setupMarketMakerOffers.mjs` on testnet).

---

## Pending pipeline growing

1. Check `release_blocked` → [RELEASE_BLOCKED runbook](./RELEASE_BLOCKED_RUNBOOK.md)
2. Check `dispute_refund_pending` → [Refund Retry](./REFUND_RETRY_RUNBOOK.md)
3. Check `stuck_escrow_locked` → matching/timeouts, orphan job settings
4. Review recent audit logs for `escrow_release_blocked`, `refund_failed`

---

## Alerts

```http
GET /api/v1/admin/system/alerts
POST /api/v1/admin/system/alerts/:id/resolve
```

---

## Daily monitoring checklist

- [ ] `/health` → 200
- [ ] `quoteSource` = LIVE
- [ ] `pathDiscovery.available` = true
- [ ] `release_blocked` = 0
- [ ] `warningLevel` acceptable for environment (WARNING OK on testnet STATIC FX)
- [ ] Escrow USDC sufficient for demo volume

---

## Related

- [Admin Operations Overview](./ADMIN_OPERATIONS_OVERVIEW.md)
- [RELEASE_BLOCKED](./RELEASE_BLOCKED_RUNBOOK.md)
