# Pre-Mainnet Hardening Backlog

**Goal:** Strengthen Rowan on **testnet** until private pilot and mainnet cutover are honest GOs.  
**Status:** Active — 2026-07-14  
**Do not** set `STELLAR_NETWORK=mainnet` until this backlog’s P0s are done and [MAINNET_CUTOVER_CHECKLIST](./MAINNET_CUTOVER_CHECKLIST.md) is signed.

Master index: [docs/README.md](../README.md)

---

## P0 — Must close before any real-money private pilot

| ID | Item | Why | Owner | Status |
|----|------|-----|-------|--------|
| P0-1 | Finish Week 1–2 E2E matrix ([STELLAR_STRENGTHEN_TRACKER](./STELLAR_STRENGTHEN_TRACKER.md)) — especially **A1** on-chain deposit→COMPLETE | Proves money path works end-to-end | Eng | 🟡 Partial — prereqs OK + API smoke 19/19 (2026-07-14); on-chain A1 still manual per [A1_E2E_CASHOUT_RUNBOOK](./A1_E2E_CASHOUT_RUNBOOK.md) |
| P0-2 | External uptime monitor on `GET /health` + alert on admin health criticals | Blind ops = lost funds | Ops | 🟡 Setup doc ready ([UPTIME_MONITORING_SETUP](./UPTIME_MONITORING_SETUP.md)); **create monitor account** |
| P0-3 | Escrow USDC/XLM low-balance alerts practiced | Empty escrow = failed releases | Ops | ☐ |
| P0-4 | Legal opinion (Kenya corridor first) | Mainnet without legal = existential risk | Exec / Legal | ☐ |
| P0-5 | Partner MoMo agreements signed (1–2 traders) | Manual fiat leg is the product | Ops / Legal | 🟡 Draft addendum ready ([PARTNER_MOMO_PILOT_ADDENDUM](./PARTNER_MOMO_PILOT_ADDENDUM.md)); **outreach + sign** |
| P0-6 | Admin 2FA **enabled** for all live admin accounts | Console = money controls | Ops | ☐ |
| P0-7 | Dispute desk drill: open → evidence → resolve user + resolve trader + retry refund | Ops must not guess | Ops | ☐ |
| P0-8 | KYC + sanctions + freeze drill ([ROWAN_OPS_RUNBOOKS](../ROWAN_OPS_RUNBOOKS.md)) | Compliance surface is new — practice it | Ops / Compliance | ☐ |
| P0-9 | Reconciliation page checked daily for 7 days on testnet | Habit before real liability | Ops | ☐ |
| P0-10 | Pilot caps written: max per tx, daily, KYC tier | Limits real loss | Product / Compliance | ☐ |

---

## P1 — Must close before mainnet cutover (not just pilot)

| ID | Item | Why | Status |
|----|------|-----|--------|
| P1-1 | New mainnet keys + funding per [KEY_CUSTODY_AND_ACCOUNT_FUNDING](./KEY_CUSTODY_AND_ACCOUNT_FUNDING.md) | Testnet keys must never go live | ☐ |
| P1-2 | Paid / SLA Horizon provider chosen and documented | Public Horizon is not pilot-grade | ☐ |
| P1-3 | Separate production deploy (keep testnet) | SDF + common sense: two environments | ☐ |
| P1-4 | `ALLOW_STATIC_FIAT_RATES=false`, `ALLOW_FALLBACK_QUOTES=false`, stale FX blocked | Bad quotes = bad MoMo amounts | ☐ |
| P1-5 | Secrets rotated; CORS allowlist; JWT admin ≤1h | Security baseline | ☐ |
| P1-6 | Orphan recovery **disabled or dual-approved** on mainnet | Irreversible fund movement | ☐ |
| P1-7 | Fix **dismiss-leaves-escrow-locked** (or ban dismiss when escrow held) | Known ops landmine | ☐ |
| P1-8 | Require payout name (or server-side name) for sanctions screening | Name-optional cashout = AML gap | ☐ |
| P1-9 | P0 automated tests (state machine, mismatch refund, duplicate deposit) | Regression shield | ☐ |
| P1-10 | Security review / pen-test of escrow + admin + KYC upload | Real money attack surface | ☐ |
| P1-11 | Rollback / pause-quotes kill switch documented and tested | Incident containment | ☐ |
| P1-12 | On-call rotation + after-hours path | Disputes don’t wait for office hours | ☐ |

---

## P2 — Strengthen soon after private pilot starts

| ID | Item | Notes |
|----|------|-------|
| P2-1 | Status filters + assign-to-me on dispute desk | Ops queue hygiene |
| P2-2 | Open-dispute dashboard count includes all active statuses | Overview under-counts today |
| P2-3 | Admin evidence file upload | Notes-only is weak for audits |
| P2-4 | SLA auto-escalate job for disputes | Priority without automation drifts |
| P2-5 | OFAC SDN refresh schedule (`npm run script:load-ofac`) | Weekly cadence |
| P2-6 | Document image quality rules for KYC reviewers | Reduce false rejects |
| P2-7 | Load / chaos testing on quote + deposit paths | Public launch gate |
| P2-8 | `stellar.toml` on production domain (if wallet discovery needed) | Optional for MVP P2P |

---

## Already strengthened (do not re-litigate)

Track these as **done foundations** — keep them working:

- Escrow-integrated dispute resolve (not DB-only)
- RELEASE_BLOCKED / refund-retry paths + runbooks
- Live fiat FX (Phase 2H-4) with mainnet static/fallback guards
- Fraud alerts table + admin UI
- KYC submit + Supabase doc upload + admin approve/reject + signed URLs
- Sanctions screening on KYC approve + cashout (when name present)
- Escrow reconciliation admin page
- Wallet user freeze/unfreeze
- KYC document key ownership validation (IDOR fix)
- Dispute escalate → `ESCALATED` via service
- Stuck-refund retry on dispute detail UI
- Ops runbooks pack (`ROWAN_OPS_RUNBOOKS.md` + `docs/ops/*`)

---

## Suggested sequence (next 2–4 weeks)

```text
1. Close P0-1 (A1 E2E) + P0-2/3 monitoring
2. Drill P0-7 / P0-8 with real testnet cases
3. Parallel: P0-4 legal + P0-5 partners
4. Write P0-10 pilot caps
5. Only then: private pilot planning (still testnet OR tiny mainnet canary)
6. P1 custody + separate prod + Horizon → MAINNET_CUTOVER sign-off
```

---

## Session log

| Date | What | Outcome |
|------|------|---------|
| 2026-07-14 | Backlog created; docs index + custody runbook; cutover/pilot checklists updated for KYC/sanctions/recon | Active |
| 2026-07-14 | A1 runbook + uptime setup + partner addendum; Render smoke 19/19; escrow/treasury healthy | P0-1/2/5 partial — human steps remain (on-chain A1, create monitor, partner sign) |

_Add a row whenever a P0/P1 item flips status._
