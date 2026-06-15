# Admin Operations Overview

**Status:** Testnet demo operations guide  
**Last updated:** Phase 2H-3 (June 2026)  
**Network:** Stellar testnet only unless explicitly approved for pilot/mainnet

---

## What admins are responsible for

- **Monitoring platform health** — liquidity, quote source, pending pipeline, orphan counts.
- **Reviewing disputes** — evidence, payout references, on-chain escrow state; resolving via escrow-integrated endpoints only.
- **Recovering blocked settlements** — `RELEASE_BLOCKED`, `DISPUTE_REFUND_PENDING`, failed refunds; never DB-only fixes.
- **Trader lifecycle** — onboarding review, verification, suspension for fraud or SLA failure.
- **Security response** — disable compromised accounts, preserve audit logs, escalate secret rotation.
- **Demo/pilot support** — manual mobile money payout oversight (Rowan does not send mobile money automatically).
- **Audit discipline** — every settlement action must leave an audit trail.

---

## What admins must never do

| Never | Why |
|-------|-----|
| Mark `COMPLETE` without `stellar_release_tx` | False completion; funds stay locked or lost |
| Mark `REFUNDED` without `stellar_refund_tx` | User appears refunded but is not |
| Use `PUT /admin/disputes/:id/resolve` | **410** — legacy DB-only path blocked |
| Use `POST /admin/transactions/:id/force-complete` or `force-refund` | **409** — dangerous paths blocked |
| Use `POST /admin/refund/:quoteId` on post-swap USDC transactions | **409** — must use escrow-integrated refund retry |
| Edit transaction state directly in the database | Bypasses escrow guards and audit |
| Delete or truncate audit logs | Destroys compliance evidence |
| Run orphan recovery on mainnet without executive/legal approval | Irreversible fund movement |
| Rotate `ENCRYPTION_KEY` without a TOTP re-encryption plan | Breaks stored 2FA secrets |
| Print secrets in tickets, chat, or logs | Credential exposure |

---

## Environment tiers

| Tier | Purpose | Real money? | Current Rowan status |
|------|---------|-------------|----------------------|
| **Testnet demo** | Product demos, integration testing | No (testnet XLM/USDC) | **Ready** |
| **Private pilot** | Controlled real-money ops with verified partners | Yes (fiat leg manual) | **Not ready** |
| **Mainnet production** | Public launch | Yes | **Not ready** |

Testnet demos use **live fiat FX** (ExchangeRate-API, Phase 2H-4) when provider is healthy. STATIC fallback remains testnet-only with WARNING. Crypto quotes use **LIVE** path discovery on testnet.

---

## Key dashboards and endpoints

All admin routes require `Authorization: Bearer <admin JWT>` unless noted.

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Public liveness (db, redis, horizon, uptime) |
| `POST /api/v1/auth/admin/login` | Admin login (2FA gate if enabled) |
| `POST /api/v1/auth/admin/2fa/verify-login` | Complete login when 2FA enabled |
| `GET /api/v1/admin/system/health` | Liquidity, pending counts, `warningLevel` |
| `GET /api/v1/admin/rates` | Rates + liquidity summary |
| `GET /api/v1/admin/escrow/status` | Escrow activity snapshot |
| `GET /api/v1/admin/escrow/transactions` | In-flight escrow transactions |
| `GET /api/v1/admin/escrow/pending-refunds` | Failed / pending refunds |
| `GET /api/v1/admin/audit-logs` | Audit trail search |
| `POST /api/v1/admin/disputes/:id/resolve` | Escrow-integrated dispute settlement |
| `POST /api/v1/admin/transactions/:id/retry-refund` | USDC refund retry (user-win) |
| `POST /api/v1/admin/escrow/refund-retry/:transactionId` | XLM refund retry (pre-swap / FAILED) |
| `POST /api/v1/admin/escrow/release-retry/:transactionId` | USDC release retry (`RELEASE_BLOCKED` only) |

See individual runbooks for procedure details.

---

## Audit logging expectations

- Every admin login, 2FA event, dispute resolution, refund retry, and blocked dangerous endpoint is logged.
- Actions use `audit_logs` with `actor_role`, `actor_id`, `action`, `resource_type`, `resource_id`, metadata.
- Admin 2FA verification also writes to `admin_2fa_verification_logs`.
- **Do not delete logs.** Export for incidents if needed.

Common actions: `admin_login`, `admin_2fa_required`, `admin_2fa_success`, `dispute_resolve_user`, `dispute_resolve_trader`, `transaction_refund_retry`, `release_retry_succeeded`, `release_retry_blocked`, `dangerous_endpoint_blocked`, `escrow_release_blocked`.

---

## Escalation rules

| Severity | Examples | Action |
|----------|----------|--------|
| **P0** | Suspected admin compromise, mass failed releases, escrow drained | Disable accounts, pause matching if needed, page on-call, preserve logs |
| **P1** | `RELEASE_BLOCKED` count > 0, `quoteSource = FALLBACK`, CRITICAL health | Follow runbook, fix root cause within SLA |
| **P2** | Open disputes aging past SLA, WARNING health (STATIC FX) | Review queue, document |
| **P3** | Demo support, trader onboarding backlog | Normal ops |

Escalate to engineering when: no documented recovery path exists, Horizon is down > 15 min, or settlement state machine rejects valid retries.

---

## Daily checklist (testnet demo)

- [ ] `GET /health` → 200
- [ ] `GET /admin/system/health` — check `warningLevel`, `pending.release_blocked`, `pending.dispute_*`
- [ ] `quoteSource` = `LIVE` (not `FALLBACK`)
- [ ] Escrow USDC balance reasonable for demo volume
- [ ] Open disputes reviewed (none stuck > SLA)
- [ ] Active orphan count = 0 (or documented exceptions)
- [ ] No unexpected `dangerous_endpoint_blocked` audit entries

---

## End-of-day checklist

- [ ] Pending pipeline empty or all items assigned
- [ ] No transactions stuck in `RELEASE_BLOCKED` overnight without owner
- [ ] Audit log spot-check for anomalous admin actions
- [ ] Document any manual interventions in dispute notes
- [ ] Confirm seeded/demo admin 2FA state matches policy (enabled for production admins when pilot starts)

---

## Related runbooks

- [RELEASE_BLOCKED](./RELEASE_BLOCKED_RUNBOOK.md)
- [Dispute Resolution](./DISPUTE_RESOLUTION_RUNBOOK.md)
- [Refund Retry](./REFUND_RETRY_RUNBOOK.md)
- [Orphan Recovery](./ORPHAN_RECOVERY_RUNBOOK.md)
- [Manual Mobile Money Payout](./MANUAL_MOBILE_MONEY_PAYOUT_RUNBOOK.md)
- [Health and Rates Monitoring](./HEALTH_AND_RATES_MONITORING_RUNBOOK.md)
- [Security Incident](./SECURITY_INCIDENT_RUNBOOK.md)
- [Mainnet Cutover Checklist](./MAINNET_CUTOVER_CHECKLIST.md)
- [Pilot Go/No-Go](./PILOT_GO_NO_GO_CHECKLIST.md)
