# A1 E2E Cash-out Runbook (Testnet)

**Goal:** Prove one USDC cash-out goes **quote → escrow deposit → trader MoMo → user confirm → COMPLETE** on testnet.  
**Tracker row:** [STELLAR_STRENGTHEN_TRACKER](./STELLAR_STRENGTHEN_TRACKER.md) — case **A1**  
**Network:** testnet only

---

## Prerequisites (check before starting)

Run from `backend/` (uses local `.env` for keys; API can be Render):

```bash
npm run script:check-escrow
npm run script:treasury-status
```

| Check | How | Pass? |
|-------|-----|-------|
| API health | `GET https://rowan-1-9crb.onrender.com/health` → `status=ok` (allow **60s** cold start) | ☐ |
| Escrow exists + USDC trustline (Circle testnet issuer) | `script:check-escrow` | ☐ |
| Escrow has USDC + XLM for fees | same | ☐ |
| Treasury can fund a test wallet | `script:treasury-status` USDC > 0 | ☐ |
| ≥1 verified trader online with float | Admin → Traders / Express quote succeeds | ☐ |
| Test user wallet with USDC + trustline | Mobile/web wallet or faucet | ☐ |

**Verified 2026-07-14 (local diagnostic):** escrow `GCIRNEH3…` has **~1564 USDC** + **~19k XLM** on testnet; treasury **~180 USDC**. Re-check before each A1 session.

---

## Happy path (A1) — do this once and record evidence

### 1. User — get quote
1. Open user wallet (testnet build → Render API).
2. **Express Cash Out** or marketplace sell.
3. Pick network (e.g. MTN UG / M-Pesa KE) and amount within trader float.
4. Confirm quote. Note: `transaction_id` / quote memo.

### 2. User — deposit USDC to escrow
1. App shows escrow address + **memo** + USDC amount.
2. Send **exact** USDC to escrow with that memo (in-app send or Lab).
3. Wait until state is escrow-locked / matched (Horizon watcher).

**Evidence:** Stellar payment tx hash (user → escrow).

### 3. Trader — accept + payout
1. Trader app: open request → **Accept**.
2. Send MoMo to the shown phone (testnet pilot: you may simulate / use a real small MoMo if agreed).
3. Mark **Payout sent** + reference.

**Evidence:** Rowan request id + payout reference.

### 4. User — confirm receipt
1. User confirms only if MoMo arrived (or for pure testnet drill, confirm after trader marks sent).
2. System should release USDC escrow → trader wallet.

**Evidence:** Stellar release tx hash; Rowan state `COMPLETE`.

### 5. Verify
- User history shows COMPLETE with correct USDC.
- Trader USDC balance increased (Horizon).
- Admin → Transactions: state `COMPLETE`, `stellar_release_tx` set.
- Optional: Admin → Reconciliation still sensible.

### 6. Mark the tracker
In [STELLAR_STRENGTHEN_TRACKER](./STELLAR_STRENGTHEN_TRACKER.md) row **A1**:

```
PASS YYYY-MM-DD
tx deposit: <hash>
tx release: <hash>
rowan_tx: <uuid>
```

---

## API smoke (does **not** replace A1)

Smoke proves quotes/marketplace/admin wiring; it does **not** do full on-chain deposit→release.

```bash
cd backend
$env:SMOKE_API_URL="https://rowan-1-9crb.onrender.com"
npm run script:smoke-mvp1
```

Use smoke after deploys; use **this runbook** for A1 PASS.

---

## If something breaks

| Symptom | Go to |
|---------|--------|
| Deposit not detected | Memo mismatch / wrong asset / Horizon watcher — check admin tx + Horizon |
| Matched but no accept | Trader offline / accept timeout → rematch |
| `RELEASE_BLOCKED` | [RELEASE_BLOCKED_RUNBOOK](./RELEASE_BLOCKED_RUNBOOK.md) — trader USDC trustline |
| User says no MoMo | Dispute path — [DISPUTE_RESOLUTION_RUNBOOK](./DISPUTE_RESOLUTION_RUNBOOK.md) |
| Escrow low USDC | Top up testnet escrow / stop new quotes |

---

## Session log

| Date | Result | Notes |
|------|--------|-------|
| 2026-07-14 | Prerequisites OK | Escrow + treasury healthy; health 200; **A1 on-chain still to execute manually** |

_Add a row when A1 is PASS or FAIL._
