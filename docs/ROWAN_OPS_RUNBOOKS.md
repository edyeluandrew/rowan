# Rowan Operations Runbooks

Operational playbooks for the Rowan support/ops/compliance desk. These cover the
day-to-day incidents an operator will face: disputes, stuck settlements, sanctions
hits, KYC review, account freezes, fraud alerts, and reconciliation breaks.

> **Audience:** ops/support/compliance staff using the Admin console.
> **Scope:** pilot / testnet operations. Not legal advice — see the compliance
> team before any real-money decision. Every money-sensitive action below is
> audit-logged (`audit_logs`) with the acting admin id.

---

## 0. Conventions & access

- **Admin console:** all actions below are performed in the Rowan admin app unless
  a "manual DB" step is explicitly called out.
- **Roles:** only `role = 'admin'` accounts can access `/api/v1/admin/*`.
- **Audit:** resolve, refund retry, freeze, KYC approve/reject, sanctions add/remove,
  and screening overrides all write to `audit_logs`. Never bypass the console with
  raw SQL unless a runbook explicitly says so, and if you do, record it.
- **Severity language:** 🔴 act now · 🟠 same business day · 🟡 within SLA · 🟢 informational.

---

## 1. Disputes

### 1.1 Lifecycle & statuses

```
OPEN → TRADER_RESPONDED → UNDER_REVIEW → ESCALATED
                       ↘ RESOLVED_FOR_USER  (→ refund)   ↘
                       ↘ RESOLVED_FOR_TRADER (→ release)   → CLOSED
                       ↘ DISMISSED                        ↗
```

The linked **transaction** moves in lockstep:

| Dispute action | Transaction state | Money effect |
|---|---|---|
| User opens dispute | `DISPUTE_OPENED` | Escrow **locked** (USDC held) |
| Resolve for user | `DISPUTE_REFUND_PENDING` → `REFUNDED` | USDC refunded to user wallet |
| Resolve for trader | `DISPUTE_RELEASE_PENDING` → `COMPLETE` | USDC released to trader |
| Dismiss | *(unchanged — see 1.6)* | ⚠️ escrow stays locked |

### 1.2 SLA & prioritization

- Each dispute has an **SLA deadline** (48h from open by default, `sla_deadline`).
- Priority is derived automatically: `ESCALATED` and SLA-breaching disputes rank
  **high**; use the priority tabs in the Disputes list to work the queue top-down.
- **Work order:** high priority / SLA-breaching first, then oldest `OPEN`.

### 1.3 Reviewing a dispute (🟡)

1. Open the dispute from **Disputes → row**.
2. Read: reason, transaction summary, **timeline**, **chat history**, and
   **evidence files** (user + trader uploads; signed URLs, open in new tab).
3. If the trader has not responded and the claim needs their side, use
   **Escalate** or leave a note; the trader is notified to respond.
4. Decide based on evidence (see decision guide 1.4).

### 1.4 Decision guide

- **Refund the user** when: payment was never received by the user, wrong amount,
  proof of non-delivery, or trader unresponsive past SLA with a credible user claim.
- **Release to trader** when: trader provides valid proof of payment matching the
  order (amount, phone, timestamp) and the user's claim is unsupported.
- **Dismiss** when: the dispute is invalid/duplicate/mistaken and **no money needs
  to move** (⚠️ read 1.6 first — dismiss currently leaves the tx locked).
- When in doubt, **Escalate** and add a note; do not guess on fund movement.

### 1.5 Resolving (🟠)

1. Click **Resolve Dispute** → choose outcome (Refund User / Release to Trader / Dismiss).
2. Enter clear `adminNotes` — this is the on-record resolution reason.
3. Confirm. The system transitions the transaction and enqueues the escrow job.
4. Verify the transaction reaches `REFUNDED` (user win) or `COMPLETE` (trader win)
   within a few minutes. If it stays pending, go to **§2 Stuck settlements**.

### 1.6 ⚠️ Known issue — "Dismiss" leaves escrow locked

Dismissing a dispute updates the dispute row to `DISMISSED` but does **not** currently
transition the linked transaction out of `DISPUTE_OPENED`, so the USDC stays locked.

**Until the fix ships, do NOT dismiss a dispute on a transaction that still holds
escrowed funds.** Instead:
- If the user's claim is invalid → **Resolve for trader** (releases funds correctly).
- If the trade should be voided → **Resolve for user** (refunds correctly).
- Only use **Dismiss** for disputes on transactions that are already terminal
  (`COMPLETE`/`REFUNDED`) — e.g. post-completion appeals with no funds held.

If a transaction is already stuck from a past dismiss, escalate to engineering to
transition it manually; do not hand-edit `transactions.state` without eng review.

### 1.7 Escalation

Use **Escalate** to raise a dispute to `ESCALATED` (records who/when/why, notifies
admins, and bumps priority to high). Escalate whenever a decision needs a second
reviewer, involves large amounts, or touches a sanctions/fraud flag.

---

## 2. Stuck settlements (refund / release pending)

### 2.1 Symptoms

- Transaction stuck in `DISPUTE_REFUND_PENDING`, `DISPUTE_RELEASE_PENDING`, or
  `RELEASE_BLOCKED`.
- Health/liquidity panel shows pending refunds or blocked releases.

### 2.2 Most common cause

The destination wallet has **no USDC trustline** (user for refunds, trader for
releases). The on-chain payment cannot land until the trustline exists.

### 2.3 Procedure — retry a stuck refund (🔴 for user funds)

1. Open the dispute (it will show a **"Refund pending"** card in the actions column).
2. Ask the user (via support) to add a USDC trustline in their wallet.
3. Click **Retry refund**. Outcomes:
   - `refunded` / `already_refunded` → done, verify tx is `REFUNDED`.
   - `blocked` → trustline still missing; retry after the user adds it.
   - `failed` → transient chain/Horizon error; retry shortly, then escalate.
4. If it will not clear after the trustline is confirmed, escalate to engineering
   with the transaction id and the retry result code.

> Refund retry is **idempotent** — clicking it twice will not double-pay.

### 2.4 Blocked release to trader

`RELEASE_BLOCKED` means the trader wallet cannot receive USDC (usually trustline).
Have the trader add the trustline, then resolve/retry. Do not re-resolve the dispute.

---

## 3. Sanctions / PEP screening hits

Screening runs at two points: **KYC approval** and **cash-out payout**. A hit at or
above the configured threshold **hard-blocks** the action.

### 3.1 Payout screening hit (🔴)

- User sees a generic "recipient could not be verified" block; a `SANCTIONS_HIT`
  fraud alert is logged.
- **Do not** advise the user how to bypass it. Open **Screening → recent activity**
  and **Fraud Alerts** to review the match (name, score, matched entity/source).
- If it is a **true match** → keep blocked, freeze the user (§5), and escalate to
  compliance for a filing decision.
- If it is a **clear false positive** (different person, obviously unrelated) →
  document in the fraud alert / screening notes and escalate to compliance; only
  compliance authorizes proceeding.

### 3.2 KYC screening hit (🔴)

- KYC **approval is blocked** on a hit. The submission stays `PENDING`.
- Review the match in **Screening**. For a genuine false positive, an authorized
  reviewer can **override with a written reason** at approval time — this is
  recorded on the screening check and in the audit log.
- Never override without a documented reason and compliance sign-off for anything
  that is not an obvious false positive.

### 3.3 Managing the internal blocklist

- **Screening** page → add/remove internal (INTERNAL-source) entities.
- Adding an entity takes effect within ~5 minutes (cache TTL) or immediately on the
  next cold read. Use for locally-known bad actors not on OFAC.
- You can only deactivate `INTERNAL` entries; OFAC SDN rows are managed by the loader.

### 3.4 Refreshing OFAC data

Run the loader to refresh the OFAC SDN list:

```bash
cd backend && npm run script:load-ofac
```

Re-run on a schedule (e.g. weekly) and after major sanctions news.

---

## 4. KYC review

### 4.1 Queue & SLA

- **KYC** page lists submissions; work **PENDING** first, oldest first, within SLA.
- Tiers and limits are configured in the backend (`NONE` → `BASIC` → `VERIFIED`);
  approval raises the user's level and daily limit atomically.

### 4.2 Reviewing (🟡)

1. Open a submission; review full name, DOB, document type/number/country.
2. Open each **document image** (front / back / selfie) via the signed-URL links.
3. Check: document is legible, not expired, name matches, selfie matches the ID,
   and the document is of the declared type.

### 4.3 Approve

- Click **Approve**. Screening runs first (see §3.2). On a clean screen the user is
  upgraded and notified.
- If screening hits, resolve per §3.2 before overriding.

### 4.4 Reject

- Click **Reject** and provide a **clear reason** (the user sees it). Common reasons:
  blurry/partial document, name mismatch, expired ID, selfie mismatch, suspected
  tampering. The user can re-submit.

---

## 5. Account freeze / unfreeze

Freezing sets `is_active = FALSE`, which blocks the user's session auth and any
new transactions immediately.

### 5.1 When to freeze (🔴)

- Confirmed or strongly-suspected fraud, a sanctions true-match, an active
  investigation, or a chargeback/law-enforcement request.

### 5.2 Procedure

1. **Users** page → search by user id / stellar address / email.
2. Open the user detail drawer; review **recent risk signals** (fraud alerts,
   screening checks, latest KYC).
3. **Freeze** → enter a required reason (audit-logged). The user is blocked at once.
4. To reverse after review: **Unfreeze** (audit-logged).

> Freeze is reversible and does not move funds. It is the first containment step —
> pair it with a dispute/refund decision and a compliance escalation as needed.

---

## 6. Fraud alerts

- **Fraud Alerts** page lists alerts with severity and type (`SANCTIONS_HIT`,
  velocity/limit alerts, etc.).
- **Triage:** work `HIGH` and unacknowledged first. Open the linked user, review
  signals, take action (freeze / dispute / escalate), then **Acknowledge** with the
  outcome noted.
- Acknowledging records who cleared it and when — do it only after you have acted,
  not to clear the queue.

---

## 7. Reconciliation

The **Reconciliation** page compares on-chain escrow USDC against the database
liability (what Rowan owes across open/pending obligations).

### 7.1 Reading it

- **Balanced / within tolerance** → 🟢 no action.
- **On-chain < liability** (shortfall) → 🔴 potential missing funds; freeze new
  high-value activity if systemic and escalate to engineering + finance immediately.
- **On-chain > liability** (surplus) → 🟠 usually un-swept fees or a mis-recorded
  settlement; investigate but lower urgency.

### 7.2 Procedure

1. Note the exact figures and timestamp.
2. Cross-check pending refunds/releases (§2) — stuck settlements explain many breaks.
3. If unexplained after clearing pending items, escalate with the report snapshot.
4. Re-run after settlements clear to confirm the break closes.

---

## 8. Incident response (general)

1. **Contain:** freeze implicated accounts (§5); if platform-wide financial risk,
   escalate to engineering to pause the affected flow.
2. **Assess:** identify scope — one user, one trader, one corridor, or systemic.
3. **Preserve:** do not delete data; audit logs and screening/fraud records are the
   evidence trail.
4. **Escalate:** engineering for technical faults, compliance for AML/sanctions,
   finance for reconciliation breaks.
5. **Record:** write a short incident note (what happened, when, actions, owner).
6. **Follow-up:** confirm resolution, then unfreeze / re-enable as appropriate.

---

## 9. Daily ops checklist

- [ ] Work the **Disputes** queue — high priority / SLA-breaching first.
- [ ] Clear any **DISPUTE_REFUND_PENDING** / **RELEASE_BLOCKED** transactions (§2).
- [ ] Triage new **Fraud Alerts** (HIGH first) and acknowledge with outcomes.
- [ ] Review **PENDING KYC** submissions within SLA.
- [ ] Review **Screening** HITs and internal blocklist requests.
- [ ] Check **Reconciliation** is within tolerance.
- [ ] Confirm no accounts were frozen without a recorded reason.

---

## 10. Known issues / engineering backlog (ops-visible)

| # | Issue | Ops impact | Workaround |
|---|---|---|---|
| 1 | **Dismiss leaves tx locked** (§1.6) | Escrow can stay locked after dismiss | Resolve for user/trader instead; escalate stuck txs to eng |
| 2 | Open-dispute dashboard count only counts `OPEN` | Under-counts active disputes (`TRADER_RESPONDED`/`UNDER_REVIEW`/`ESCALATED`) | Use the Disputes list, not just the overview number |
| 3 | No admin file-evidence upload | Admin can add text notes only | Attach context in notes; store files in the case system |
| 4 | No dispute "assign to me" / ownership | Two admins can work the same case | Coordinate; note who is handling in admin notes |
| 5 | Payout screening only runs when a payout **name** is provided | Name-less payouts are unscreened by name | Require/collect payout name at cash-out (product change pending) |

Keep this table current as fixes land.
