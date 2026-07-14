# Stellar Strengthen Tracker

**Goal:** Harden Stellar cash-out / buy / disputes before any multi-chain (Alchemy) work.  
**Status:** Week 1–2 in progress (compliance/ops tooling landed Jul 2026; E2E A1 still open)  
**Network:** testnet until Week 3 cutover items are green  

Do **not** start Base/Alchemy until the Week 1 matrix is mostly PASS and a tiny private pilot is defined.  
Do **not** flip mainnet until [MAINNET_CUTOVER_CHECKLIST](./MAINNET_CUTOVER_CHECKLIST.md) is signed and [PRE_MAINNET_HARDENING_BACKLOG](./PRE_MAINNET_HARDENING_BACKLOG.md) P0s are closed.

**Docs index:** [docs/README.md](../README.md)

---

## Progress

| Phase | Focus | Status |
|-------|--------|--------|
| Week 1–2 | E2E matrix on testnet (happy + failure paths) | 🟡 IN PROGRESS |
| Week 2 | Health + alerts + escrow balance monitoring | 🟡 PARTIAL (admin health/recon exist; external uptime alert still open) |
| Compliance desk | KYC, sanctions, fraud alerts, freeze, recon, ops runbooks | ✅ LANDED 2026-07-14 (practice drills still open) |
| Week 3 | Mainnet cutover checklist (config + keys) | ⬜ NOT STARTED — see [KEY_CUSTODY](./KEY_CUSTODY_AND_ACCOUNT_FUNDING.md) |
| Week 3–4 | Critical-path automated tests | ⬜ NOT STARTED |
| Then | Tiny real-money private pilot (1–2 traders) | ⬜ BLOCKED |
| Only then | Sketch Base + Alchemy adapter #2 | ⬜ DEFERRED |

---

## Prerequisites (before any case)

```bash
# Backend
cd backend && npm run dev   # :4000

# Clients (as needed)
cd rowan-mobile && npm run dev
cd admin && npm run dev
```

| Check | How | Pass? |
|-------|-----|-------|
| `GET /health` → db + redis + horizon connected | curl / browser | ✅ PASS 2026-07-13 (`rowan-1-9crb.onrender.com`) |
| `STELLAR_NETWORK=testnet` | env | ✅ PASS |
| Escrow exists + USDC trustline | `node scripts/checkEscrowAccount.mjs` / `checkEscrowTrustline.mjs` | ☐ |
| Escrow has test USDC / XLM for fees | `node scripts/checkEscrowUsdc.mjs` | ☐ |
| MM offers (if XLM path used) | `node scripts/checkMarketMaker.mjs` | ☐ |
| ≥1 verified trader online + float | admin traders / `fix-test-traders-for-matching.mjs` | ✅ PASS (smoke seeded `test.trader.flow@rowan.local`) |
| Test wallet funded (USDC) | faucet `POST /api/v1/testnet/fund-usdc` or treasury runbook | ☐ |
| Admin login + 2FA if enabled | admin app | ✅ PASS (smoke admin overview) |

**API smoke (2026-07-13):** `npm run script:smoke-mvp1` vs Render → **18 passed, 1 failed** (health cold-start timeout; rechecked OK). Covers sell/buy quotes, marketplace ads, disputes, admin queues — **not** full on-chain A1 deposit→release yet.

**Related:** [TESTNET_TREASURY_RUNBOOK.md](./TESTNET_TREASURY_RUNBOOK.md), [HEALTH_AND_RATES_MONITORING_RUNBOOK.md](./HEALTH_AND_RATES_MONITORING_RUNBOOK.md)

---

## Week 1–2 — E2E matrix

Mark each row: **PASS / FAIL / BLOCKED** + date + tx hash or notes.

### A. Happy paths

| ID | Case | Steps (API / UI) | Expect | Result |
|----|------|------------------|--------|--------|
| A1 | **USDC cash-out complete** | Quote → send USDC+memo to escrow → trader accept → payout-sent → user confirm-receipt → release | States through `COMPLETE`; trader receives USDC; float settles | 🟡 PARTIAL 2026-07-13 — quote/config OK via smoke; on-chain deposit→COMPLETE still TODO |
| A2 | **XLM cash-out complete** (if still offered) | Quote → send XLM+memo → swap → match → MoMo → confirm → release | `ESCROW_LOCKED` after swap; then `COMPLETE` | ☐ |
| A3 | **Buy flow complete** | `POST /buy/quote` → confirm → user MoMo → trader verifies → USDC to user | Buy states complete; user USDC credited | ☐ |
| A4 | **Receipt + history** | After A1: `GET /cashout/receipt/:id`, user/trader history | Receipt matches amounts; history shows COMPLETE | ☐ |
| A5 | **Socket updates** | Watch wallet + trader during A1 | Events for match, payout, complete (no stuck UI) | ☐ |

**Primary endpoints (cash-out):**

| Step | Method |
|------|--------|
| Quote | `POST /api/v1/cashout/quote` |
| Status | `GET /api/v1/cashout/status/:id` (auth) |
| Trader accept | `POST /api/v1/trader/requests/:id/accept` |
| Payout sent | `POST /api/v1/trader/requests/:id/payout-sent` |
| User confirm | `POST /api/v1/user/transactions/:id/confirm-receipt` |
| Dispute (user) | `POST /api/v1/user/transactions/:id/dispute` |

### B. Deposit / quote failures

| ID | Case | How to trigger | Expect | Result |
|----|------|----------------|--------|--------|
| B1 | Wrong amount | Send USDC ≠ quoted (beyond tolerance) | Refund USDC; quote invalid; no stuck lock | ☐ |
| B2 | Expired quote | Wait past TTL, then deposit | Refund; expired handling | ☐ |
| B3 | Unknown / garbage memo | Deposit with bad memo | Refund orphan path; no phantom tx | ☐ |
| B4 | Duplicate deposit same memo | Send twice | Second ignored (Redis lock); no double match | ☐ |
| B5 | Quote with no eligible trader | Pause traders / zero float | Quote fails or match fails cleanly; user not stuck | ☐ |

### C. Trader / matching failures

| ID | Case | How to trigger | Expect | Result |
|----|------|----------------|--------|--------|
| C1 | Accept timeout | Don’t accept within accept window | Rematch or fail per config; float not stolen | ☐ |
| C2 | Trader declines | `POST .../decline` | Rematch to another or fail path | ☐ |
| C3 | Payout window timeout | Accept but never payout-sent | Timeout job; rematch/fail; runbook path clear | ☐ |
| C4 | Insufficient float mid-flight | Lower float after match | Guarded; no oversell | ☐ |

### D. Settlement / release failures

| ID | Case | How to trigger | Expect | Result |
|----|------|----------------|--------|--------|
| D1 | `RELEASE_BLOCKED` | Trader wallet missing USDC trustline | State `RELEASE_BLOCKED` (not false COMPLETE); admin release-retry works after trustline | ☐ |
| D2 | Admin release retry | `POST /api/v1/admin/escrow/release-retry/:transactionId` | Completes when trustline fixed | ☐ |
| D3 | Admin refund retry | `POST /api/v1/admin/escrow/refund-retry/:transactionId` | User refunded; state terminal | ☐ |

### E. Disputes

| ID | Case | How to trigger | Expect | Result |
|----|------|----------------|--------|--------|
| E1 | User dispute after payout-sent | User opens dispute + evidence | `DISPUTE_OPENED`; trader can respond | ☐ |
| E2 | Admin → user wins (refund) | Admin resolve refund | USDC back to user; float correct | ☐ |
| E3 | Admin → trader wins (release) | Admin resolve release | USDC to trader; COMPLETE path | ☐ |
| E4 | Post-complete appeal (if enabled) | Dispute after COMPLETE within window | Re-opens safely; no double-pay | ☐ |

### F. Auth / safety smoke

| ID | Case | Expect | Result |
|----|------|--------|--------|
| F1 | Cashout status without JWT | 401 | ☐ |
| F2 | Trader cannot confirm another trader’s request | 403/404 | ☐ |
| F3 | Admin force endpoints require admin + sensitive limits | Rejects non-admin | ☐ |
| F4 | CORS / rate limit smoke on auth | Limits trip under burst (non-prod OK) | ☐ |

### G. Script assists (optional automation helpers)

| Script | Use for |
|--------|---------|
| `backend/scripts/testE2eCashout.mjs` | Partial quote/deposit smoke (verify paths still match `/api/v1`) |
| `backend/scripts/phase2h1-runtime-tests.mjs` | RELEASE_BLOCKED / admin guard regressions |
| `backend/scripts/phase2h2-runtime-tests.mjs` | Auth / 2FA related |
| `backend/scripts/phase2h3b-runtime-tests.mjs` | Release retry |
| `backend/scripts/phase2h4-runtime-tests.mjs` | Fiat FX live posture |
| `backend/scripts/checkEscrowUsdc.mjs` | Escrow balance |
| `backend/scripts/orphanRecoverySweep.mjs` | Orphans — **restrict on mainnet** |

After each PASS row, paste **Stellar tx hash(es)** and **transaction UUID** in notes (Notion/Linear/PR comment — keep this file as the scoreboard).

**Week 1–2 exit criteria:** A1 + B1–B4 + C1 + D1–D2 + E2–E3 all PASS on testnet.

---

## Week 2 — Health + alerts + escrow monitoring

### Already in product

| Signal | Endpoint / tool |
|--------|-----------------|
| Public health | `GET /health` |
| Deep health (escrow XLM/USDC, MM, path, FX) | `GET /api/v1/admin/system/health` |
| Fraud / system alerts list | `GET /api/v1/admin/system/alerts` |
| Escrow status | `GET /api/v1/admin/escrow/status` |
| Thresholds | `HEALTH_ESCROW_USDC_WARN`, `HEALTH_ESCROW_XLM_CRIT`, `HEALTH_STUCK_MINUTES` |

### Ops checklist

| Task | Pass? |
|------|-------|
| Document who checks `/health` daily (or uptime monitor URL) | ☐ |
| External ping on `GET /health` (UptimeRobot / Render / Better Stack) → page on 503 | ☐ |
| Alert when admin health `warningLevel` / criticals non-empty (escrow USDC low, Horizon down, FX not LIVE) | ☐ |
| Dashboard or cron note for stuck txs older than `HEALTH_STUCK_MINUTES` | ☐ |
| Confirm `fx_source=LIVE` on testnet demo env (Phase 2H-4) | ☐ |
| Practice: [RELEASE_BLOCKED_RUNBOOK](./RELEASE_BLOCKED_RUNBOOK.md), [REFUND_RETRY_RUNBOOK](./REFUND_RETRY_RUNBOOK.md), [ORPHAN_RECOVERY_RUNBOOK](./ORPHAN_RECOVERY_RUNBOOK.md) | ☐ |

**Week 2 exit:** public health monitored + one person can triage escrow low / RELEASE_BLOCKED from runbooks without guessing.

---

## Week 3 — Mainnet cutover (config + keys)

Track against [MAINNET_CUTOVER_CHECKLIST.md](./MAINNET_CUTOVER_CHECKLIST.md). Summary scoreboard:

| Area | Items | Pass? |
|------|-------|-------|
| Fiat | `ALLOW_STATIC_FIAT_RATES=false`, `ALLOW_FALLBACK_QUOTES=false`, live FX SLA envs | ☐ |
| Stellar | `STELLAR_NETWORK=mainnet`, mainnet Horizon, `USDC_ISSUER_MAINNET`, new escrow + trustline, MM funded | ☐ |
| Security | CORS allowlist, secrets rotated, admin 2FA, JWT admin ≤1h | ☐ |
| Ops | Monitoring live, on-call, rollback plan, orphan tooling restricted | ☐ |
| Legal | Partner MoMo agreements, KYC policy for pilot volume | ☐ |

**Do not flip mainnet** until Engineering + Ops sign the cutover doc.

---

## Week 3–4 — Critical-path automated tests

Backend currently has **no** `*.test.js` suite. Add a minimal spine (Jest or node:test):

| Priority | Test | Why |
|----------|------|-----|
| P0 | `transactionStateMachine` valid + invalid transitions | Prevents silent bad states |
| P0 | Deposit amount mismatch → refund path (unit/mock) | Money safety |
| P0 | Duplicate deposit lock | Double-pay prevention |
| P1 | Matching rejects insufficient float | Oversell |
| P1 | Admin release-retry only from `RELEASE_BLOCKED` / allowed states | Ops safety |

Suggested location: `backend/src/services/__tests__/` (or `backend/tests/`).  
Wire `npm test` in `backend/package.json` and run in CI when ready.

**Week 3–4 exit:** P0 tests green in CI or local pre-deploy checklist.

---

## Then — Tiny private pilot

| Gate | Requirement |
|------|-------------|
| Week 1 matrix exit | Met |
| Week 2 monitoring | Met |
| Mainnet keys | Escrow + traders trustlined; tiny USDC only |
| Traders | 1–2 verified partners, manual MoMo OK |
| Caps | Hard KYC/daily limits; max per tx tiny |
| Rollback | Kill switch / pause quotes documented |

---

## Only then — Alchemy / other chains

When pilot is stable:

1. Keep Stellar settlement as source of truth  
2. Add **one** chain (prefer Base) via Alchemy Address Activity webhook  
3. Adapter pattern: `horizonWatcher` (Stellar) ‖ `alchemyWatcher` (EVM) → same state machine  

No EVM work before this tracker’s pilot gate.

---

## Session log

| Date | What ran | Outcome |
|------|----------|---------|
| 2026-07-13 | Tracker created; Week 1 matrix defined | Ready to execute cases A–F |
| 2026-07-14 | KYC/sanctions/recon/freeze + ops runbooks; docs index + custody + hardening backlog | Compliance desk landed; A1 still TODO; mainnet still NO-GO |

_Add a row each test session._
