# Manual Mobile Money Payout Policy (MVP)

**Status:** Pilot MVP — manual partner payout model  
**Last updated:** Phase 2F (June 2026)

This document formalizes how Rowan handles fiat (mobile money) payouts today. Rowan does **not** integrate MTN, Airtel, or M-Pesa payout APIs in this phase.

---

## 1. What Rowan automates

- **Quote and escrow:** User receives a locked quote, sends XLM to Rowan escrow, and funds are held until settlement completes.
- **Trader matching:** Rowan assigns a verified partner trader who accepts the cash-out request.
- **On-chain settlement:** After successful user confirmation (or dispute resolution), Rowan releases USDC from escrow to the trader, or refunds the user per policy.
- **Dispute workflow:** Users can open disputes; admins review evidence and resolve with release or refund.
- **Notifications:** In-app (and optional SMS) updates for state changes.
- **Audit logging:** Admin and settlement actions are logged for review.

## 2. What Rowan does not automate yet

- **Sending mobile money:** Rowan does **not** push funds to the user's mobile money wallet.
- **Carrier verification:** Rowan does **not** verify payout references with MTN, Airtel, or Safaricom systems.
- **Instant fiat settlement:** Fiat leg timing depends on the partner's manual transfer and the user's confirmation.
- **Automatic dispute proof validation:** Proof is partner-submitted and admin-reviewed, not carrier-confirmed.

## 3. Partner (trader) responsibilities

- Maintain sufficient float and active payout settings for accepted networks.
- Accept only requests they can fulfill within SLA.
- Perform **manual partner payout** to the user's mobile money number shown in the order.
- Submit a **partner-submitted reference** (transaction ID, receipt number, or similar) in the trader app.
- Respond to disputes within the required window with proof of payment (screenshots, receipts).
- Follow Rowan trader agreement and verification requirements.

## 4. User confirmation responsibility

- After the partner marks payout sent, the user must **confirm receipt** only if funds appear in their mobile money account.
- Users should **not** confirm receipt before checking their mobile money balance/history.
- If funds do not arrive within a reasonable time, the user should open a dispute rather than confirm.

## 5. Payout reference limitations

- References are **partner-submitted**, not carrier-verified by Rowan.
- A reference does not prove delivery until the user confirms or admin resolves a dispute.
- References may be mistyped, reused, or from unrelated transfers — admin review may be required.
- Rowan stores references for audit and dispute resolution only.

## 6. Dispute rules

- Users may dispute when they did not receive the expected mobile money amount.
- Disputes freeze settlement until admin review.
- Partners must provide proof within the configured response window.
- Admin resolution outcomes:
  - **User wins:** USDC escrow refunds to user (per settlement policy).
  - **Trader wins:** USDC escrow releases to trader.
- Repeated false disputes or fraudulent partner behavior may lead to account restrictions.

## 7. Admin review policy

- Review open disputes with both user report and partner proof.
- Prefer on-chain escrow state + timestamps + reference + proof artifacts.
- Do not treat partner reference alone as sufficient proof of delivery.
- Document resolution notes in admin tools.
- Escalate patterns suggesting fraud, collusion, or systemic partner failure.

## 8. Fraud and risk notes

- Manual payout introduces **counterparty risk** on the fiat leg; escrow protects the crypto leg only until settlement.
- Users confirming receipt without verifying balance creates **friendly fraud** risk for partners.
- Partners marking sent without transferring creates **user loss** risk until dispute resolution.
- Pilot operations should monitor dispute rates, confirmation times, and partner SLAs.
- KYC tiers and transaction limits apply per platform policy.

## 9. Wording that must not be used

Do **not** use in product copy, API messages, or support docs:

| Avoid | Use instead |
|-------|-------------|
| "Rowan sent mobile money" | "Partner reported manual mobile money payout" |
| "Automatically sent to your number" | "Partner-submitted payout — confirm receipt" |
| "Carrier-confirmed reference" | "Partner-submitted reference" |
| "Verified by MTN/Airtel/M-Pesa" | "Not carrier-verified in MVP" |
| "Instant mobile money settlement" | "Manual partner payout; confirm when received" |
| "Payout completed by Rowan" | "Escrow settlement complete after user-confirmed receipt" |

## 10. Future mobile money API integration path

When Rowan integrates operator APIs (post-pilot):

1. **Provider abstraction:** `payoutProvider.send({ network, msisdn, amount, reference })` behind feature flags per country/operator.
2. **Status webhooks:** Replace passive user confirmation where carriers support delivery callbacks; retain user confirmation as fallback.
3. **Reference validation:** Where APIs expose transaction lookup, cross-check partner-submitted references.
4. **Gradual rollout:** Start with one operator/market; keep manual partner payout as fallback.
5. **Policy update:** Revise this document when API-backed payout is live; until then, treat all fiat legs as **manual partner payout** with **dispute-safe escrow**.

---

**Summary:** Rowan's MVP is **dispute-safe escrow** for the crypto leg plus **manual partner payout** and **user-confirmed receipt** for the fiat leg. Rowan does not send mobile money on behalf of partners today.
