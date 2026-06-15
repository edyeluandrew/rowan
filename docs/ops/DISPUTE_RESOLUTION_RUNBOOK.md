# Dispute Resolution Runbook

**When to use:** A user opened a dispute; escrow is locked pending admin review.

---

## Transaction states in dispute flows

| State | Meaning |
|-------|---------|
| `DISPUTE_OPENED` | Dispute filed; escrow locked; awaiting trader response / admin review |
| `DISPUTE_RELEASE_PENDING` | Admin ruled **trader win**; USDC release to trader queued/in progress |
| `DISPUTE_REFUND_PENDING` | Admin ruled **user win**; USDC refund to user queued/in progress |
| `RELEASE_BLOCKED` | Release attempted but blocked (e.g. trustline) — see [RELEASE_BLOCKED](./RELEASE_BLOCKED_RUNBOOK.md) |
| `COMPLETE` | USDC released to trader; `stellar_release_tx` required |
| `REFUNDED` | USDC refunded to user; `stellar_refund_tx` required |

Dispute record statuses include: `OPEN`, `TRADER_RESPONDED`, `UNDER_REVIEW`, `ESCALATED`, `RESOLVED_FOR_USER`, `RESOLVED_FOR_TRADER`, `DISMISSED`, `CLOSED`.

---

## Evidence admins should review

| Source | What to check |
|--------|---------------|
| **Payout reference** | Partner-submitted; **not carrier-verified** — may be mistyped |
| **Partner proof** | Screenshots, receipts, timestamps (trader dispute response) |
| **User report** | Dispute reason, amount claimed, timing |
| **Transaction state** | State history, `payout_reference`, `fiat_payout_submitted_at` |
| **Stellar escrow** | Deposit, swap, current USDC in escrow; no premature release/refund hash |
| **Audit logs** | `dispute_created`, `dispute_trader_responded`, prior admin actions |

**Rule:** Partner reference alone is **not** sufficient proof of delivery. Prefer reference + proof + user confirmation pattern + timestamps.

---

## Trader-win process

**When:** User received mobile money (or evidence supports trader); trader should receive USDC.

1. Review evidence; add admin notes.
2. Resolve via escrow-integrated endpoint:

```http
POST /api/v1/admin/disputes/:id/resolve
Authorization: Bearer <admin token>
Content-Type: application/json

{
  "resolution": "RESOLVED_FOR_TRADER",
  "adminNotes": "User confirmed off-platform / proof verified"
}
```

Aliases accepted: `"release"`.

3. System transitions transaction → `DISPUTE_RELEASE_PENDING` and enqueues USDC release.
4. Verify `stellar_release_tx` on Horizon → `COMPLETE`.
5. If release blocks → `RELEASE_BLOCKED` — follow [RELEASE_BLOCKED runbook](./RELEASE_BLOCKED_RUNBOOK.md).

**Audit:** `dispute_resolve_trader`, `escrow_release` (on success).

---

## User-win process

**When:** User did not receive mobile money; refund USDC from escrow to user.

1. Review evidence; confirm user Stellar address has USDC trustline (or will add).
2. Resolve:

```http
POST /api/v1/admin/disputes/:id/resolve
{
  "resolution": "RESOLVED_FOR_USER",
  "adminNotes": "No proof of payout; user claim credible"
}
```

Aliases: `"refund"`.

3. Transaction → `DISPUTE_REFUND_PENDING`; refund job runs.
4. If stuck (missing trustline, Horizon error):

```http
POST /api/v1/admin/transactions/:id/retry-refund
```

Or: `POST /api/v1/admin/disputes/:id/retry-refund`

5. Verify `stellar_refund_tx` → `REFUNDED`.

**Audit:** `dispute_resolve_user`, `refund_succeeded` / `refund_failed` / `refund_blocked_missing_trustline`.

---

## Dismiss dispute

When claim is invalid or duplicate:

```json
{ "resolution": "DISMISSED", "adminNotes": "..." }
```

Closes dispute without moving escrow (transaction returns to prior settlement path per `disputeService` logic).

**Audit:** `dispute_dismiss`.

---

## What NOT to do

| Blocked action | Response |
|----------------|----------|
| `PUT /admin/disputes/:id/resolve` | **410** + `dangerous_endpoint_blocked` |
| `POST /admin/transactions/:id/force-complete` | **409** |
| `POST /admin/transactions/:id/force-refund` | **409** |
| Mark `REFUNDED` without `stellar_refund_tx` | Settlement guard rejects |
| Mark `COMPLETE` without `stellar_release_tx` | Settlement guard rejects |
| Post-swap XLM refund via `POST /admin/refund/:quoteId` | **409** on post-swap |

---

## Escalation

- `POST /api/v1/admin/disputes/:id/escalate` — marks under review with reason.
- `POST /api/v1/admin/disputes/:id/note` — internal note only.

---

## Expected audit events

`dispute_created`, `dispute_trader_responded`, `dispute_evidence_added`, `dispute_resolve_user`, `dispute_resolve_trader`, `dispute_dismiss`, `dispute_escalate`, `dispute_refund_pending`, `escrow_release`, `refund_succeeded`, `refund_failed`.

---

## Related

- [Refund Retry](./REFUND_RETRY_RUNBOOK.md)
- [Manual Mobile Money Payout](./MANUAL_MOBILE_MONEY_PAYOUT_RUNBOOK.md)
- Policy: [docs/MANUAL_MOBILE_MONEY_PAYOUT_POLICY.md](../MANUAL_MOBILE_MONEY_PAYOUT_POLICY.md)
