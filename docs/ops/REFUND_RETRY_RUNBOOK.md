# Refund Retry Runbook

**When to use:** A refund was attempted but did not complete on-chain, or admin needs to safely retry USDC/XLM return to the user.

---

## When refund retry is allowed

| Scenario | State | Endpoint |
|----------|-------|----------|
| **User-win dispute refund stuck** | `DISPUTE_REFUND_PENDING` | `POST /admin/transactions/:id/retry-refund` |
| **Same, via dispute ID** | `DISPUTE_REFUND_PENDING` | `POST /admin/disputes/:id/retry-refund` |
| **Pre-swap XLM orphan / FAILED** | `FAILED` (pre-swap, no USDC) | `POST /admin/escrow/refund-retry/:transactionId` |
| **Pre-swap manual admin refund** | Pre-swap, not COMPLETE/REFUNDED | `POST /admin/refund/:quoteId` (XLM only) |

---

## User-win dispute refund

1. Confirm resolution: `RESOLVED_FOR_USER` applied; state = `DISPUTE_REFUND_PENDING`.
2. Check user USDC trustline on Horizon.
3. Retry:

```http
POST /api/v1/admin/transactions/:transactionId/retry-refund
Authorization: Bearer <admin token>
```

**Responses:**

| Status | Meaning |
|--------|---------|
| 200 `refunded` | Refund completed; check `stellar_refund_tx` |
| 200 `already_refunded` | Idempotent no-op |
| 200 `blocked` / `failed` | Still pending — fix trustline/balance, retry later |
| 409 | Wrong state (e.g. already released) |

4. Confirm `stellar_refund_tx` on Horizon.
5. Terminal state: `REFUNDED`.

---

## Common blockers

| Blocker | Fix |
|---------|-----|
| **User missing USDC trustline** | User adds trustline; retry |
| **Horizon failure** | Wait for connectivity; retry |
| **Insufficient escrow USDC** | Fund escrow; investigate leak; escalate |
| **Wrong state** | Do not force — use dispute resolve path first |

---

## Pre-swap XLM refund retry

For transactions that **failed before USDC swap** (XLM still the escrow asset):

```http
POST /api/v1/admin/escrow/refund-retry/:transactionId
{ "reason": "Horizon timeout retry" }
```

Allowed when `state = FAILED` (or `REFUNDED` without `stellar_refund_tx`).

**Audit:** `transaction_refund_retry`.

---

## Pre-swap manual refund (quote-based)

```http
POST /api/v1/admin/refund/:quoteId
{ "reason": "Admin manual pre-swap refund" }
```

**Only pre-swap:** no `stellar_swap_tx` with `usdc_amount > 0`.

**Post-swap:** returns **409** `"Post-swap refund blocked"` with `useInstead: POST /api/v1/admin/escrow/refund-retry/:transactionId` (XLM path) or dispute USDC refund paths — **do not use XLM refund for post-swap USDC**.

**Audit:** `admin_manual_refund` (pre-swap) or `dangerous_endpoint_blocked` (post-swap attempt).

---

## What NOT to do

- **Do not** call `POST /admin/refund/:quoteId` on post-swap transactions.
- **Do not** use `POST /admin/transactions/:id/force-refund` (**409** blocked).
- **Do not** UPDATE `stellar_refund_tx` in DB without on-chain tx.
- **Do not** refund XLM when USDC is the escrow asset (post-swap).

---

## When to keep admin review

- Refund retry returns `blocked` repeatedly.
- Escrow balance mismatch.
- Suspected fraud (user and trader collusion).
- Amount mismatch vs quote.

Document in dispute notes; escalate to P1.

---

## Expected audit events

`refund_started`, `refund_retry`, `refund_succeeded`, `refund_failed`, `refund_blocked_missing_trustline`, `transaction_refund_retry`, `admin_manual_refund`, `dangerous_endpoint_blocked`, `dispute_refund_pending`.

---

## Related

- [Dispute Resolution](./DISPUTE_RESOLUTION_RUNBOOK.md)
- [Orphan Recovery](./ORPHAN_RECOVERY_RUNBOOK.md)
