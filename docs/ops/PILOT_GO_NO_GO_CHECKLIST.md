# Pilot Go / No-Go Checklist

**Last updated:** 2026-07-14

Honest status assessment for Rowan release tiers.

**Master index:** [docs/README.md](../README.md)

---

## Tier definitions

| Tier | Description |
|------|-------------|
| **Testnet demo** | Product demos, integration testing, no real fiat |
| **Private pilot** | Controlled real-money ops with verified partners |
| **Real-money pilot** | Broader pilot with production-like controls |
| **Public launch** | General availability on mainnet |

---

## Current status summary

| Tier | Ready? | Notes |
|------|--------|-------|
| **Testnet demo** | **YES** | Settlement + FX + admin ops + new KYC/sanctions/recon tooling on testnet |
| **Private pilot** | **NO** | Legal, partners, monitoring drills, E2E A1, caps still open — see [PRE_MAINNET_HARDENING_BACKLOG](./PRE_MAINNET_HARDENING_BACKLOG.md) |
| **Real-money pilot** | **NO** | Needs private pilot GO + mainnet cutover items |
| **Public launch** | **NO** | Mainnet cutover incomplete |

---

## Testnet demo readiness

### Go criteria

- [x] Stellar testnet settlement (XLM → USDC swap, escrow, release, refund)
- [x] Normal release path works
- [x] Trader-win dispute release works
- [x] User-win refund works
- [x] RELEASE_BLOCKED false-COMPLETE bug fixed (Phase 2H-1)
- [x] Dangerous DB-only admin endpoints guarded
- [x] Admin 2FA backend (Phase 2H-2)
- [x] TOTP encryption at rest
- [x] Cashout status authenticated
- [x] Rate limits wired
- [x] `quoteSource = LIVE` on testnet
- [x] Active orphans = 0 (or documented)
- [x] Admin ops runbooks published (`docs/ops/`)
- [x] Live fiat FX provider integrated (Phase 2H-4)
- [x] Fraud alerts API + admin UI
- [x] KYC submit + document upload (Supabase) + admin review
- [x] Sanctions screening (KYC + cashout-when-named) + admin screening tools
- [x] Escrow reconciliation admin page
- [x] Wallet user freeze/unfreeze
- [x] Ops runbooks pack including disputes / AML / freeze ([ROWAN_OPS_RUNBOOKS](../ROWAN_OPS_RUNBOOKS.md))

### Known demo limitations

- Mobile money is manual partner payout
- No carrier-verified payout references
- Full on-chain E2E matrix (Strengthen Tracker A1) still to be fully marked PASS
- Payout sanctions screening only when `payoutName` is provided
- Dismiss dispute can leave escrow locked (ops must not dismiss while funds held)

**Verdict: GO for testnet demos**

---

## Private pilot readiness

### Required before GO

- [ ] Week 1–2 E2E exit criteria met ([STELLAR_STRENGTHEN_TRACKER](./STELLAR_STRENGTHEN_TRACKER.md))
- [ ] Production FX freshness monitoring / alerts
- [ ] Partner manual payout SLAs documented and monitored
- [ ] Admin 2FA enabled on all ops admins (not just backend support)
- [ ] Pilot partner verification complete (1–2 traders)
- [ ] Dispute SLA and escalation tested with real cases
- [ ] KYC + sanctions + freeze drill completed
- [ ] Reconciliation habit (daily) for ≥7 days
- [ ] Legal/compliance sign-off for pilot jurisdiction
- [ ] Incident runbook drill completed
- [ ] Monitoring alerts for `release_blocked`, escrow low balance
- [ ] Per-transaction and daily limits enforced and tested (pilot caps written)
- [ ] P0 items in [PRE_MAINNET_HARDENING_BACKLOG](./PRE_MAINNET_HARDENING_BACKLOG.md) closed

**Verdict: NO-GO today**

---

## Real-money pilot readiness

Everything in private pilot, plus:

- [ ] Mainnet or approved production Stellar network
- [x] Live FX with stale-rate blocking (Phase 2H-4)
- [ ] `ALLOW_FALLBACK_QUOTES=false`
- [ ] Production CORS allowlist
- [ ] Secrets rotation from testnet; **new** mainnet keys ([KEY_CUSTODY](./KEY_CUSTODY_AND_ACCOUNT_FUNDING.md))
- [ ] Session revocation or short admin TTL enforced (1h ✓)
- [ ] Fraud monitoring thresholds calibrated
- [ ] Reconciliation process (fiat leg vs crypto / escrow) operational
- [ ] Customer support playbooks
- [ ] [MAINNET_CUTOVER_CHECKLIST](./MAINNET_CUTOVER_CHECKLIST.md) Engineering + Ops sections complete

**Verdict: NO-GO today — not pilot-ready**

---

## Public launch readiness

Everything in real-money pilot, plus:

- [ ] [Mainnet Cutover Checklist](./MAINNET_CUTOVER_CHECKLIST.md) complete (all sign-offs)
- [ ] Load testing
- [ ] Full security audit
- [ ] Regulatory approvals as required
- [ ] Automated mobile money (if product requires — currently out of scope)

**Verdict: NO-GO today**

---

## Go/No-Go decision record

| Date | Tier | Decision | Approver | Notes |
|------|------|----------|----------|-------|
| 2026-06 | Testnet demo | **GO** | Ops | Phase 2H-3 runbooks complete |
| 2026-06 | Real-money pilot | **NO-GO** | — | Manual fiat, ops gaps, mainnet not cut over |
| 2026-07-14 | Testnet demo | **GO** | — | Compliance tooling + ops docs strengthened; still testnet |
| 2026-07-14 | Private pilot | **NO-GO** | — | Hardening backlog P0 open; legal/partners pending |

---

## Related

- [Mainnet Cutover Checklist](./MAINNET_CUTOVER_CHECKLIST.md)
- [Pre-Mainnet Hardening Backlog](./PRE_MAINNET_HARDENING_BACKLOG.md)
- [Admin Operations Overview](./ADMIN_OPERATIONS_OVERVIEW.md)
- [Manual Mobile Money Payout](./MANUAL_MOBILE_MONEY_PAYOUT_RUNBOOK.md)
- [Docs index](../README.md)
