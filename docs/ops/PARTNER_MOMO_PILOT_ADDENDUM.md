# Rowan Partner MoMo Pilot Addendum — Draft v0.1

**Status:** DRAFT for outreach — not legal advice. Have counsel review before binding signature.  
**Purpose:** Short addendum for **1–2 pilot partners** who already accept (or will accept) the [Trader Agreement v1.0](../../backend/static/trader-agreement-v1.0.md).  
**Related:** [MANUAL_MOBILE_MONEY_PAYOUT_POLICY](../MANUAL_MOBILE_MONEY_PAYOUT_POLICY.md), [ROWAN_BUSINESS_MODEL §2](../ROWAN_BUSINESS_MODEL.md)

---

## How to use this

1. Fill **Partner details** and **Pilot caps** below.  
2. Send to the partner with Trader Agreement v1.0.  
3. Both parties sign (e-sign or wet ink).  
4. Store PDF in ops folder / Drive; note trader id in admin.  
5. Replace this draft after legal review for production.

---

## Parties

| | |
|--|--|
| **Platform** | Rowan (“Rowan”) |
| **Partner** | _________________________________ (“Partner”) |
| **Trading as / entity** | _________________________________ |
| **Primary contact** | Name _____________ Phone _____________ Email _____________ |
| **Networks** | ☐ MTN UG ☐ Airtel UG ☐ M-Pesa KE ☐ Other: _____________ |
| **Stellar wallet (USDC)** | G________________________________ |
| **Pilot start date** | _____________ |
| **Pilot end / review date** | _____________ (suggest 4–8 weeks) |

---

## 1. Relationship

Partner is an **independent liquidity provider**. Partner is **not** an employee, agent, or joint venture of Rowan. Partner operates its own mobile-money float at its own risk. Classification under local payment/VASP rules is subject to separate legal advice.

---

## 2. What Rowan does / does not do

**Rowan does:** quote matching, USDC escrow lock/release/refund on Stellar, dispute workflow, notifications, audit logs.

**Rowan does not:** send mobile money, verify carrier references automatically, or guarantee “instant” fiat delivery. Fiat timing depends on Partner’s manual transfer. See Manual Mobile Money Payout Policy.

---

## 3. Pilot service levels (edit numbers)

| Metric | Pilot target |
|--------|----------------|
| Accept window | Within **3 minutes** of match (or platform default) |
| MoMo send after accept | Within **5–10 minutes** |
| Payout reference | Mandatory on “payout sent” |
| Dispute evidence | Within **24 hours** of request |
| Declared hours | ______________________________ |
| Min working float (declare) | _____________ UGX / KES / other |

Partner must keep the app **online** during declared hours and honour accepted orders.

---

## 4. Pricing (pilot)

- Partner earns via wholesale USDC vs their cost of fiat (per Trader Agreement).  
- Partner spread must stay within Rowan’s **pilot cap (≤ 2% unless otherwise agreed in writing)**.  
- No off-platform pricing or settlement with Rowan users.

---

## 5. Wrong payout / loss allocation

| Event | Who bears loss (pilot default) |
|-------|--------------------------------|
| Partner sends to **wrong number** or wrong amount after accepting | **Partner** |
| Partner marks “sent” but did not pay; dispute finds for user | **Partner** (USDC may be refunded to user; trust score / suspension) |
| User confirms receipt without checking (friendly fraud) | Reviewed case-by-case; pattern abuse may restrict the user |
| Mobile-money network outage after Partner correctly paid (proof clear) | Escalation; typically not charged to Partner if proof is strong |
| Stellar / escrow bug attributable to Rowan | Rowan (crypto leg) |

Rowan’s max liability on a single order is the **USDC amount of that order**, unless mandatory law says otherwise.

---

## 6. Proof & disputes

- Partner submits a **payout reference** and keeps screenshots/receipts.  
- References are **partner-submitted**, not carrier-verified by Rowan.  
- On dispute: Partner cooperates within SLA; Rowan decides on evidence; escrow stays locked until resolve.  
- Outcomes: refund user **or** release USDC to Partner.

---

## 7. Prohibited conduct (summary)

Fake/edited proofs; off-platform deals with users; soliciting users off Rowan; collusion; sanctions evasion; handling proceeds of crime; falsified KYC/KYB docs.

---

## 8. Suspension

Rowan may pause matching immediately for SLA breach, unpaid accepted orders, fraud suspicion, or AML/sanctions concerns. Graduated: warning → throttle → suspension → termination of pilot seat.

---

## 9. Pilot caps & compliance

Partner acknowledges:

- Pilot may enforce **per-tx and daily caps** and KYC tiers on users.  
- Partner will complete Rowan verification (ID, MoMo OTP, float declaration, wallet USDC trustline).  
- Partner will not process payouts they believe are suspicious; escalate to Rowan.

---

## 10. Data

Partner data handled per Trader Agreement (ID docs, wallet, payout proofs for disputes). Rowan does not sell Partner data.

---

## 11. Term

This addendum applies for the **pilot period** above and renews only by written agreement. Either party may end the pilot with **7 days’ notice**, after wind-down of open orders. Trader Agreement terms continue unless terminated.

---

## 12. Governing law

Governing law / venue: ______________________________ *(to be set with counsel — e.g. Kenya or Uganda as applicable)*.

---

## Signatures

**Rowan**  
Name: _________________ Title: _________________  
Signature: _________________ Date: _____________

**Partner**  
Name: _________________ Title: _________________  
Signature: _________________ Date: _____________

---

## Outreach checklist (ops)

- [ ] Identify Partner 1 (name/phone) — e.g. existing verified trader  
- [ ] Identify Partner 2 (optional backup)  
- [ ] Send: Trader Agreement v1.0 + this Addendum + MoMo Policy (1-pager summary OK)  
- [ ] Walk through wrong-payout table on a call (10 min)  
- [ ] Collect signed PDF + Stellar address + float declaration  
- [ ] Confirm USDC trustline on partner wallet  
- [ ] Enable matching / mark verified in admin  

### Suggested outreach message (short)

> Hi — we’re opening a small Rowan pilot (USDC escrow ↔ mobile money). You’d be one of 1–2 payout partners. Rowan locks USDC; you send MoMo manually and get USDC when the user confirms (or after dispute). Attached: trader agreement + short pilot addendum (SLA, wrong-send liability, caps). Can we hop on a 15-min call this week?

---

**Version:** draft v0.1 — 2026-07-14  
**Not a substitute for a lawyer-reviewed contract.**
