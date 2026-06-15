# Pilot Go / No-Go Checklist

**Last updated:** Phase 2H-3 (June 2026)

Honest status assessment for Rowan release tiers.

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
| **Testnet demo** | **YES** | Crypto settlement works; STATIC fiat FX WARNING expected |
| **Private pilot** | **NO** | Manual mobile money only; no live FX; ops gaps remain |
| **Real-money pilot** | **NO** | Not pilot-ready |
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

### Known demo limitations

- Fiat FX is STATIC → `warningLevel = WARNING` (expected)
- Mobile money is manual partner payout
- No carrier-verified payout references
- Admin release-retry HTTP endpoint missing for some RELEASE_BLOCKED cases

**Verdict: GO for testnet demos**

---

## Private pilot readiness

### Required before GO

- [ ] Live fiat FX provider integrated
- [ ] Partner manual payout SLAs documented and monitored
- [ ] Admin 2FA enabled on all ops admins (not just backend support)
- [ ] Admin console wired for 2FA setup
- [ ] Pilot partner verification complete
- [ ] Dispute SLA and escalation tested with real cases
- [ ] Legal/compliance sign-off for pilot jurisdiction
- [ ] Incident runbook drill completed
- [ ] Monitoring alerts for `release_blocked`, escrow low balance
- [ ] Per-transaction and daily limits enforced and tested

**Verdict: NO-GO today**

---

## Real-money pilot readiness

Everything in private pilot, plus:

- [ ] Mainnet or approved production Stellar network
- [ ] Live FX with stale-rate blocking
- [ ] `ALLOW_FALLBACK_QUOTES=false`
- [ ] Production CORS allowlist
- [ ] Secrets rotation from testnet
- [ ] Session revocation or short admin TTL enforced (1h ✓)
- [ ] Fraud monitoring thresholds calibrated
- [ ] Reconciliation process (fiat leg vs crypto leg)
- [ ] Customer support playbooks

**Verdict: NO-GO today — not pilot-ready**

---

## Public launch readiness

Everything in real-money pilot, plus:

- [ ] [Mainnet Cutover Checklist](./MAINNET_CUTOVER_CHECKLIST.md) complete
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
| 2026-06 | Real-money pilot | **NO-GO** | — | STATIC FX, manual fiat, ops gaps |

---

## Related

- [Mainnet Cutover Checklist](./MAINNET_CUTOVER_CHECKLIST.md)
- [Admin Operations Overview](./ADMIN_OPERATIONS_OVERVIEW.md)
- [Manual Mobile Money Payout](./MANUAL_MOBILE_MONEY_PAYOUT_RUNBOOK.md)
