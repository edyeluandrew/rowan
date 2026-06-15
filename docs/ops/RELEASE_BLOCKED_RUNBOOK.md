# RELEASE_BLOCKED Runbook

**When to use:** A transaction is in state `RELEASE_BLOCKED` — USDC could not be released to the trader.

---

## What RELEASE_BLOCKED means

The platform attempted an on-chain USDC release from escrow to the trader's Stellar address but **blocked** before broadcasting (or before completion). Funds remain locked in escrow. The transaction is **not** complete.

Common trigger: user confirmed receipt (`POST /user/transactions/:id/confirm-receipt`) or dispute resolution enqueued a trader release, and `escrowController.releaseToTrader()` failed a pre-flight check.

---

## Common causes

| Cause | How to detect |
|-------|---------------|
| **Trader missing USDC trustline** | Horizon: trader account has no USDC balance line for testnet issuer |
| **Invalid trader Stellar address** | `traders.stellar_address` null, malformed, or account not found on Horizon |
| **Insufficient escrow USDC balance** | `GET /admin/system/health` → `liquidity.escrow.usdc_balance` |
| **Horizon / network failure** | `/health` horizon disconnected; release job errors in logs |
| **Concurrent release lock** | Redis lock held; usually transient — retry after TTL |

Check transaction fields: `failure_reason`, `release_error`, `stellar_release_tx` (should be null).

---

## Step 1 — Inspect the transaction

**Admin console** or database read (read-only):

- `state` = `RELEASE_BLOCKED`
- `stellar_deposit_tx`, `stellar_swap_tx` (post-swap USDC in escrow)
- `usdc_amount`
- `trader_id` → trader `stellar_address`
- `failure_reason` / `release_error`
- `stellar_release_tx` must be **null** until fixed

**Audit events to look for:**

- `escrow_release_blocked` — system blocked release
- `user_confirm_release_blocked` — user confirm-receipt returned blocked status

---

## Step 2 — Verify escrow state

```
GET /api/v1/admin/system/health
```

Confirm:

- `liquidity.escrow.exists` = true
- `liquidity.escrow.usdc_trustline` = true
- `liquidity.escrow.usdc_balance` ≥ transaction `usdc_amount`
- `liquidity.horizon.reachable` = true

Optional: `GET /api/v1/admin/escrow/transactions` — find the transaction in the active list.

---

## Step 3 — Verify trader trustline

On Stellar testnet Horizon, load the trader's public key:

- Account must **exist**
- Must have a **USDC trustline** for the configured testnet USDC issuer
- Address must match `traders.stellar_address` in Rowan

**Fix:** Trader adds USDC trustline on testnet (or admin updates address after trader re-registers wallet).

---

## What NOT to do

- **Do not** mark `COMPLETE` manually (force-complete returns **409**).
- **Do not** UPDATE `state` in the database to `COMPLETE`.
- **Do not** retry blindly without fixing the root cause.
- **Do not** assume fiat was delivered — RELEASE_BLOCKED is a **crypto release** failure; mobile money is separate.

---

## Correct recovery path

1. **Fix root cause** (trustline, address, escrow funding, Horizon connectivity).
2. **Retry escrow-integrated release** — funds must move on-chain before `COMPLETE`.

### Dispute-origin RELEASE_BLOCKED

If the transaction reached `RELEASE_BLOCKED` from `DISPUTE_RELEASE_PENDING`:

- After fixing the trader trustline, re-trigger release via dispute workflow:
  - `POST /api/v1/admin/disputes/:id/resolve` with `resolution: RESOLVED_FOR_TRADER` (if dispute still open), **or**
  - Bull `releaseQueue` may retry automatically (check job logs).

### Normal confirm-receipt RELEASE_BLOCKED

If blocked after user confirm-receipt (`USER_CONFIRMATION_PENDING` → `RELEASE_BLOCKED`):

- User **cannot** call confirm-receipt again (state guard returns **409**).
- User **cannot** open a dispute from `RELEASE_BLOCKED` (disputable states are `FIAT_PAYOUT_SUBMITTED`, `USER_CONFIRMATION_PENDING` only).

**Known operational gap:** There is currently **no** `POST /admin/escrow/release-retry/:transactionId` HTTP endpoint. Escalate to engineering for an approved recovery that transitions back to a retryable state after the trustline fix, or implement a release-retry endpoint in a future phase.

3. **Confirm on-chain success:** `stellar_release_tx` populated on Horizon.
4. **Confirm terminal state:** `state` = `COMPLETE` only after successful release.

---

## Expected audit events (successful recovery)

| Action | When |
|--------|------|
| `escrow_release` | USDC release succeeded |
| `escrow_release_blocked` | Initial block (already present) |
| `dispute_resolve_trader` | If recovered via dispute path |

---

## Monitoring

`GET /admin/system/health` → `pending.release_blocked`  
Any count **> 0** is **CRITICAL** in health checks.

---

## Related

- [Dispute Resolution](./DISPUTE_RESOLUTION_RUNBOOK.md)
- [Health and Rates Monitoring](./HEALTH_AND_RATES_MONITORING_RUNBOOK.md)
- [Admin Operations Overview](./ADMIN_OPERATIONS_OVERVIEW.md)
