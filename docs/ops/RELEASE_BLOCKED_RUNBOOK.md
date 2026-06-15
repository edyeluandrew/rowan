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
2. **Verify trader USDC trustline** on Horizon.
3. **Call admin release-retry** (escrow-integrated):

```http
POST /api/v1/admin/escrow/release-retry/:transactionId
Authorization: Bearer <admin token>
Content-Type: application/json

{}
```

**Allowed state:** `RELEASE_BLOCKED` only. All other states return **409**.

**Success (200):**

```json
{
  "success": true,
  "state": "COMPLETE",
  "releaseHash": "<stellar tx hash>",
  "transactionId": "..."
}
```

**Still blocked (409):** trustline still missing, insufficient escrow, or Horizon error — fix and retry.

**Already complete (200):** idempotent — `status: already_complete` if `stellar_release_tx` exists.

4. **Confirm on-chain:** `stellar_release_tx` visible on Horizon.
5. **Confirm state:** `COMPLETE` (set only by escrow release logic, never manually).
6. **Verify audit logs:** `release_retry_started`, `release_retry_succeeded` (or `release_retry_blocked` / `release_retry_failed`).

### Dispute-origin RELEASE_BLOCKED

Same endpoint applies. If the dispute is still open, you may alternatively use `POST /api/v1/admin/disputes/:id/resolve` with `RESOLVED_FOR_TRADER` after fixing the trustline.

---

## Expected audit events

| Action | When |
|--------|------|
| `release_retry_started` | Admin initiated retry |
| `release_retry_succeeded` | On-chain release completed → COMPLETE |
| `release_retry_blocked` | Still blocked (e.g. missing trustline) |
| `release_retry_failed` | Network/on-chain error |
| `release_retry_wrong_state` | Not RELEASE_BLOCKED |
| `escrow_release` | System release success (also logged by releaseToTrader) |
| `escrow_release_blocked` | Initial block (already present) |

---

## Monitoring

`GET /admin/system/health` → `pending.release_blocked`  
Any count **> 0** is **CRITICAL** in health checks.

---

## Related

- [Dispute Resolution](./DISPUTE_RESOLUTION_RUNBOOK.md)
- [Health and Rates Monitoring](./HEALTH_AND_RATES_MONITORING_RUNBOOK.md)
- [Admin Operations Overview](./ADMIN_OPERATIONS_OVERVIEW.md)
