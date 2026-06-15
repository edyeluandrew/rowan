# Manual Mobile Money Payout Runbook

**When to use:** Operating testnet demos or future private pilots where fiat is sent manually by verified partners.

**Policy source:** [docs/MANUAL_MOBILE_MONEY_PAYOUT_POLICY.md](../MANUAL_MOBILE_MONEY_PAYOUT_POLICY.md)

---

## What Rowan does and does not do

| Rowan automates | Rowan does **not** automate |
|-----------------|----------------------------|
| Quote, escrow, XLM→USDC swap | Sending mobile money to user |
| Trader matching | Carrier verification of payout references |
| USDC escrow release/refund | Instant fiat settlement |
| Dispute workflow | Automatic proof validation |

---

## End-to-end flow (admin view)

```
User quote → User sends XLM → Escrow locked → Swap to USDC
    → Trader matched → Trader sends mobile money manually
    → Trader submits payout reference in app
    → User confirms receipt (only after checking mobile money)
    → USDC released to trader (or dispute/refund path)
```

---

## Partner (trader) responsibilities

- Maintain float and active payout settings for accepted networks.
- **Manually send** mobile money to the user's number on the order.
- Submit a **partner-submitted payout reference** (not carrier-verified).
- Respond to disputes with proof (screenshots, receipts).
- **No fake references** — subject to suspension.

---

## User responsibilities

- Confirm receipt **only after** funds appear in mobile money account.
- Open a dispute if funds do not arrive — do not confirm prematurely.

---

## Admin checks during pilot

| Check | Action |
|-------|--------|
| Payout reference present? | Review in transaction detail |
| Reference matches amount/network? | Compare to quote |
| User confirmed too fast? | Flag for review |
| Dispute opened? | Pause settlement; follow [Dispute runbook](./DISPUTE_RESOLUTION_RUNBOOK.md) |
| Partner SLA breach? | Escalate / suspend trader |

**Payout reference is partner-submitted, not carrier-verified.** Treat as audit evidence only.

---

## Dispute handling (fiat leg)

- User disputes non-receipt → escrow stays locked.
- Review partner proof + user claim.
- User win → USDC refund to user ([Dispute Resolution](./DISPUTE_RESOLUTION_RUNBOOK.md)).
- Trader win → USDC release to trader.

---

## Partner rules (enforce)

1. No fake or recycled references.
2. Retain proof for audit (screenshots, receipts).
3. Payout amount must match quote (within policy tolerance).
4. Supported networks/currencies only (per payout settings).

---

## User-facing wording safety

**Do not say:**

- "Rowan sent mobile money"
- "Instant mobile money delivery"
- "Carrier confirmed payment"

**Do say:**

- "Partner reported manual mobile money payout"
- "Confirm only after you see funds in your mobile money account"
- "Payout reference is reported by the partner, not verified by Rowan"

---

## Admin endpoints (fiat-adjacent)

| Endpoint | Role |
|----------|------|
| `GET /admin/escrow/transactions` | Monitor in-flight |
| `POST /admin/disputes/:id/resolve` | Settle disputes |
| `GET /admin/audit-logs` | Review partner actions |

Cashout status (`GET /cashout/status/:id`) requires user JWT — admins use admin transaction/dispute views.

---

## Related

- [Dispute Resolution](./DISPUTE_RESOLUTION_RUNBOOK.md)
- [Admin Operations Overview](./ADMIN_OPERATIONS_OVERVIEW.md)
