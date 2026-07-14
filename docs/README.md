# Rowan Documentation Index

**Purpose:** Single map of everything needed before mainnet.  
**Rule:** Stay on **testnet** until [MAINNET_CUTOVER_CHECKLIST](./ops/MAINNET_CUTOVER_CHECKLIST.md) is fully signed off.  
**Last updated:** 2026-07-14

---

## Where we are

| Tier | Ready? | Gate doc |
|------|--------|----------|
| Testnet demo | **YES** | [PILOT_GO_NO_GO](./ops/PILOT_GO_NO_GO_CHECKLIST.md) |
| Private real-money pilot | **NO** | Same + partner/legal |
| Mainnet / public launch | **NO** | [MAINNET_CUTOVER](./ops/MAINNET_CUTOVER_CHECKLIST.md) |

**Active harden plan:** [STELLAR_STRENGTHEN_TRACKER](./ops/STELLAR_STRENGTHEN_TRACKER.md)  
**Open work before flip:** [PRE_MAINNET_HARDENING_BACKLOG](./ops/PRE_MAINNET_HARDENING_BACKLOG.md)

---

## Strategy & positioning

| Doc | What it is |
|-----|------------|
| [ROWAN_BUSINESS_MODEL.md](./ROWAN_BUSINESS_MODEL.md) | Pricing, revenue, partner marketplace, compliance outline |
| [ROWAN_POSITIONING.md](./ROWAN_POSITIONING.md) | Market position — “Borderless value. Local payouts.” |
| [MANUAL_MOBILE_MONEY_PAYOUT_POLICY.md](./MANUAL_MOBILE_MONEY_PAYOUT_POLICY.md) | Product policy for partner MoMo (not automated rails) |
| [FUTURE_FIAT_FX_PROVIDER.md](./FUTURE_FIAT_FX_PROVIDER.md) | Live FX provider design (Phase 2H-4) |

---

## Go / no-go & cutover

| Doc | Use when |
|-----|----------|
| [ops/PILOT_GO_NO_GO_CHECKLIST.md](./ops/PILOT_GO_NO_GO_CHECKLIST.md) | Honest readiness by tier |
| [ops/MAINNET_CUTOVER_CHECKLIST.md](./ops/MAINNET_CUTOVER_CHECKLIST.md) | Flip testnet → mainnet (config, keys, legal, ops) |
| [ops/STELLAR_STRENGTHEN_TRACKER.md](./ops/STELLAR_STRENGTHEN_TRACKER.md) | Week-by-week E2E + monitoring before cutover |
| [ops/PRE_MAINNET_HARDENING_BACKLOG.md](./ops/PRE_MAINNET_HARDENING_BACKLOG.md) | Ranked gaps to close before real money |
| [ops/KEY_CUSTODY_AND_ACCOUNT_FUNDING.md](./ops/KEY_CUSTODY_AND_ACCOUNT_FUNDING.md) | New keys, XLM/USDC funding, never reuse testnet |

---

## Daily / incident operations

| Doc | Use when |
|-----|----------|
| [MVP1_PILOT_RUNBOOK.md](./MVP1_PILOT_RUNBOOK.md) | Plain-English day-to-day pilot ops |
| [ops/ADMIN_OPERATIONS_OVERVIEW.md](./ops/ADMIN_OPERATIONS_OVERVIEW.md) | What admins own / must never do |
| [ROWAN_OPS_RUNBOOKS.md](./ROWAN_OPS_RUNBOOKS.md) | Disputes, sanctions, KYC, freeze, recon, incidents |
| [ops/DISPUTE_RESOLUTION_RUNBOOK.md](./ops/DISPUTE_RESOLUTION_RUNBOOK.md) | Dispute desk deep dive |
| [ops/REFUND_RETRY_RUNBOOK.md](./ops/REFUND_RETRY_RUNBOOK.md) | Stuck `DISPUTE_REFUND_PENDING` |
| [ops/RELEASE_BLOCKED_RUNBOOK.md](./ops/RELEASE_BLOCKED_RUNBOOK.md) | Trader missing USDC trustline |
| [ops/ORPHAN_RECOVERY_RUNBOOK.md](./ops/ORPHAN_RECOVERY_RUNBOOK.md) | Stuck / orphan txs (**restrict on mainnet**) |
| [ops/MANUAL_MOBILE_MONEY_PAYOUT_RUNBOOK.md](./ops/MANUAL_MOBILE_MONEY_PAYOUT_RUNBOOK.md) | Partner MoMo ops |
| [ops/SECURITY_INCIDENT_RUNBOOK.md](./ops/SECURITY_INCIDENT_RUNBOOK.md) | Compromise / freeze / rotate |
| [ops/HEALTH_AND_RATES_MONITORING_RUNBOOK.md](./ops/HEALTH_AND_RATES_MONITORING_RUNBOOK.md) | Health, FX, liquidity alerts |
| [ops/TESTNET_TREASURY_RUNBOOK.md](./ops/TESTNET_TREASURY_RUNBOOK.md) | Testnet USDC faucet / Circle testnet top-up |

---

## Admin product docs

See `admin/docs/` for architecture, deployment, and phase completion notes. Prefer `docs/ops/` for live operations.

---

## Suggested reading order (pre-mainnet)

1. This index  
2. [PRE_MAINNET_HARDENING_BACKLOG](./ops/PRE_MAINNET_HARDENING_BACKLOG.md)  
3. [STELLAR_STRENGTHEN_TRACKER](./ops/STELLAR_STRENGTHEN_TRACKER.md) — finish Week 1–2 matrix  
4. [ROWAN_OPS_RUNBOOKS](./ROWAN_OPS_RUNBOOKS.md) + dispute/refund/release runbooks  
5. [KEY_CUSTODY_AND_ACCOUNT_FUNDING](./ops/KEY_CUSTODY_AND_ACCOUNT_FUNDING.md)  
6. [PILOT_GO_NO_GO](./ops/PILOT_GO_NO_GO_CHECKLIST.md) → private pilot gates  
7. [MAINNET_CUTOVER](./ops/MAINNET_CUTOVER_CHECKLIST.md) — only when everything else is green  

**Do not flip `STELLAR_NETWORK=mainnet` until Engineering + Ops + Legal/Compliance + Executive all sign the cutover checklist.**
