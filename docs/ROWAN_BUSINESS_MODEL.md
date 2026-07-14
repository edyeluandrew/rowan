# Rowan — Business Model, Pricing, Partner Agreement & Compliance
### *Borderless Value. Local Payouts.*

> **Status:** Strategy & operating document (v1). Not legal advice. All third-party fees and FX rates are **illustrative** and must be re-verified against live sources before launch. Nothing here authorises mainnet/real-money operations — that depends on the compliance gates in §4.

---

## 0. Model in one line

**Rowan = escrow-secured USDC ↔ mobile-money rails**, priced on **reference FX + a capped partner spread + a small visible Rowan fee** (hybrid spread-share + transaction fee), matched **automatic-first (Express) → curated marketplace**, launched **compliance-first in Kenya**, evolving toward a **B2B payout API**.

Current code already implements this shape: `PLATFORM_FEE_PERCENT` = **1%**, `PLATFORM_SPREAD_PERCENT` = **1.25%**, `QUOTE_SLIPPAGE_PERCENT` = **0.3%**.

---

## 1. One-page pricing sheet

### 1.1 Global pricing rules

| Lever | Pilot value | Notes |
|---|---|---|
| **Rowan platform fee** | **1.0%** | Visible, inside the all-in quote |
| **Partner spread cap** | **≤ 2.0%** | Partner's margin; hard-capped and monitored |
| **Express priority premium** | **+0.5%** | Distinct paid SKU (speed, best-match) |
| **Blended user cost** | **~3.0%** (marketplace) / **~3.5%** (Express) | Shown as one all-in rate |
| **Quote validity** | **60–120s** | Rate locked at order open; slippage guard 0.3% |
| **FX staleness** | Block new quotes if reference FX stale | Already enforced by `fxService` |
| **Network fee (Stellar)** | Absorbed by Rowan | ~fraction of a cent per op |

### 1.2 Per-corridor sheet

> Reference rates below are **illustrative placeholders** — always use the live `fxService` mid at quote time.

| Corridor | Ref FX (illustrative) | Min order | Max order (pilot) | Rowan fee | Partner spread cap | Small-ticket floor |
|---|---|---|---|---|---|---|
| **Kenya — KES** (launch) | 1 USDC ≈ 129 KES | **30 USDC** | 200 USDC | 1.0% | 2.0% | Below 30 USDC blocked |
| **Uganda — UGX** | 1 USDC ≈ 3,750 UGX | **40 USDC** | 200 USDC | 1.0% | 2.0% | Below 40 USDC blocked |
| **Tanzania — TZS** | 1 USDC ≈ 2,550 TZS | **40 USDC** | 200 USDC | 1.0% | 2.0% | Below 40 USDC blocked |

**Why minimums differ:** mobile-money "send" fees are flat bands, so on small trades the partner's spread is eaten by the MoMo cost. Minimums keep partners profitable and cut the disputes-per-dollar that small tickets generate.

### 1.3 Worked examples (Kenya, sell/cash-out; illustrative)

Assumptions: 1 USDC = 129 KES; partner spread 2%; Rowan fee 1%; M-PESA send fees per Safaricom bands.

| USDC | Ref (KES) | User receives (~97%) | Rowan fee (1%) | Partner spread (2%) | M-PESA send (partner) | Partner net |
|---|---|---|---|---|---|---|
| 30 | 3,870 | ~3,754 | ~39 | ~77 | ~57 (3,501–5,000) | **~20** (near floor) |
| 50 | 6,450 | ~6,257 | ~65 | ~129 | ~78 (5,001–7,500) | **~51** |
| 100 | 12,900 | ~12,513 | ~129 | ~258 | ~100 (10,001–15,000) | **~158** |
| 200 | 25,800 | ~25,026 | ~258 | ~516 | ~108 (20,001+) | **~408** |

**Who absorbs what:** user absorbs blended ~3% (in the rate); **partner** absorbs the MoMo send fee out of their spread; **Rowan** absorbs the trivial network fee. Rowan's clean take ≈ **1%** of converted volume.

### 1.4 Buy direction (fiat → USDC)

Mirror image: user pays MoMo to partner, receives USDC from escrow. Same fee/spread stack; partner's cash-collection cost replaces the send fee. Same minimums apply.

### 1.5 Revenue roadmap

| Now (pilot) | Early commercial | Scale |
|---|---|---|
| Spread-share + 1% fee | + Express premium, promoted placement | + Partner subscriptions (Preferred/Prime), API/enterprise fees |

---

## 2. Partner (payout provider) agreement — outline

> Template for counsel to convert into a binding contract per market. Partners are **independent liquidity providers**, not employees or Rowan agents (classification to be confirmed by counsel — see §4).

### 2.1 Parties & definitions
- Rowan entity; Partner entity; "USDC", "Escrow", "Payout Reference", "Order", "Float", "Conduct Bond", "SLA".

### 2.2 Eligibility & onboarding
- Registered business; **KYB + directors' KYC**; fit-and-proper; references; proof of source of funds for float; sanctions screening pass.
- Signed agreement + accepted policies (AML, data protection, dispute rules).

### 2.3 Float & conduct bond
- Minimum working **float** per network/currency.
- Refundable **conduct bond** (security deposit) held against breaches; deductible for proven losses/penalties.
- Float top-up and reconciliation obligations.

### 2.4 Pricing & spread
- Partner sets spread **within Rowan's cap** (≤ 2.0% pilot).
- Rowan fee deducted per §1. No off-platform pricing.

### 2.5 Service obligations
- **Payout SLA** (target release time; e.g., average ≤ 10 min, hard cap defined).
- Declared **operating hours** + availability toggle; honour matched orders.
- **Mandatory payout reference** submission; **proof retention** per policy.
- Correct-recipient verification; no wrong-number payouts.

### 2.6 Prohibited conduct
- Fake/edited references or proofs; claiming payment not sent.
- **Off-platform settlement or communication**; soliciting users.
- Colluding with users; rate manipulation; account farming.
- Handling proceeds of crime; sanctioned counterparties.

### 2.7 Disputes
- Cooperate with evidence requests within SLA.
- Rowan decides on evidence; escrow held until resolved.
- Auto-dispute (later): losses deductible from bond.

### 2.8 Ratings, ranking & tiers
- Metrics: completion %, release speed, dispute rate, volume, account age.
- Tiers: **Standard / Preferred / Prime** with matching priority + limits.

### 2.9 Penalties & suspension
- Graduated: warning → matching throttle → bond deduction → suspension → termination.
- Triggers: SLA breach, fake reference, off-platform settlement, AML breach.

### 2.10 Compliance obligations (flow-down)
- Maintain AML/KYC where applicable; report suspicious activity; comply with sanctions & Travel Rule; data protection; record retention (§4).

### 2.11 Liability, indemnity, term & termination
- Limitation of liability; indemnity for partner breaches; termination for cause; bond return conditions; wind-down of open orders.

### 2.12 Governing law & dispute resolution
- Per-market governing law; arbitration/venue clause.

---

## 3. User terms — key points (outline)
- All-in quote disclosed before confirm (reference + spread + fee + ETA + receive amount).
- Rate locked at order open; escrow protection; dispute rights if MoMo not received.
- Cancellation allowed pre-partner-payout; blocked after payout submitted.
- KYC tiers & limits; prohibited uses; no investment/returns promised.
- "Usually under X minutes" — **never** "instant/automatic" while payout is partner-operated.

---

## 4. Compliance, AML & regulatory framework

> **Not legal advice.** Items are marked **[VERIFIED]** (from official/credible sources), **[OPEN]** (needs counsel), or **[CONTROL]** (Rowan's operational safeguard).

### 4.1 Country status (East Africa)

**Kenya — most license-ready → launch market**
- **[VERIFIED]** Virtual Asset Service Providers Act, 2025 (Act No. 20 of 2025) — assented 15 Oct 2025, **effective 4 Nov 2025**. Dual regulator: **CBK** (issuance/stablecoins/payments) + **CMA** (exchanges/custody). Only **companies limited by shares** may be licensed. Existing VASPs must comply by **4 Nov 2026**.
- **[VERIFIED]** Draft VASP Regulations 2026 issued; public participation closed ~10 Apr 2026; **no licences issued yet** as of mid-2026.
- **[OPEN]** Which licence category Rowan needs (payments vs exchange/custody); transitional window; capital/liquidity thresholds.

**Uganda — no licensing yet; conversion barred**
- **[VERIFIED]** **No dedicated VASP regime.** Bank of Uganda **bars licensed entities from converting crypto into mobile money** (High Court-upheld). FIA requires AML registration for VASPs. Sandboxes exist (BoU + CMA). Comprehensive framework **expected late 2026**.
- **[OPEN]** Whether Rowan's crypto↔MoMo conversion is permissible pre-framework; sandbox entry path. **Treat Uganda real-money launch as gated on the late-2026 framework and/or sandbox admission.**

**Tanzania — rules being finalised; sandbox active**
- **[VERIFIED]** BoT finalising crypto/stablecoin regulations; **fintech regulatory sandbox** live; **nTZS** stablecoin pilot approved 2026; **GN 198 mandates domestic settlement in TZS**; crypto not legal tender.
- **[OPEN]** Sandbox application; local-currency settlement obligations for Rowan flows.

### 4.2 AML / CFT program **[CONTROL]**
- **KYC tiers:** tier limits by verification depth (basic → full ID + liveness). No trading above unverified thresholds.
- **KYB for partners:** business verification, directors, source-of-funds for float.
- **Sanctions screening:** users, partners, and **on-chain wallet screening** at onboarding + per transaction.
- **Travel Rule:** capability to collect/transmit originator & beneficiary info for qualifying transfers (referenced by both Kenya's Act and Uganda's proposed pillars).
- **Transaction monitoring:** velocity limits, structuring detection, anomaly flags, duplicate-payment/duplicate-release checks.
- **Suspicious Transaction Reporting (STR):** file with the relevant FIU/FIA; documented escalation path.
- **Risk-based approach:** enhanced due diligence for higher-risk users/corridors/amounts.

### 4.3 Custody, escrow & client-asset protection **[OPEN → CONTROL]**
- **[OPEN]** Legal treatment of escrowed client USDC (custody vs bailment vs trust) per market.
- **[CONTROL]** Segregate client escrow from operating funds; daily **escrow-liability reconciliation** must equal on-chain locked balances; documented release/refund authority.

### 4.4 Consumer protection & disclosure **[CONTROL]**
- All-in quote + fee breakdown; clear dispute & cancellation rights; complaints channel; no misleading "instant" claims; risk disclosures.

### 4.5 Data protection **[OPEN → CONTROL]**
- **[OPEN]** Compliance with Uganda Data Protection & Privacy Act, Kenya Data Protection Act, Tanzania data rules.
- **[CONTROL]** Data minimisation; PII masking (phone numbers) in chat; retention schedule; lawful basis; breach-response plan.

### 4.6 Record retention **[CONTROL]**
- Retain KYC/KYB, order, chat, payout-reference, dispute and reconciliation records per statutory period (confirm exact durations with counsel per market).

### 4.7 Mobile-money & payments interplay **[OPEN]**
- **[OPEN]** Whether payout partners are "agents"/MSBs under mobile-money agent rules; money-transmission/payment-service classification of Rowan itself; excise/VAT/digital tax treatment.

### 4.8 Compliance gate checklist (must all be ✅ before real funds)
- [ ] Written legal opinion per target market (VASP status, custody, money transmission)
- [ ] Sandbox entry where required (UG/TZ)
- [ ] KYC/KYB + sanctions + wallet screening live
- [ ] Travel-Rule capability live
- [ ] Transaction monitoring + STR process live
- [ ] Segregated escrow + daily escrow-liability reconciliation
- [ ] Signed partner contracts + conduct bonds
- [ ] Consumer disclosures + complaints channel
- [ ] Data-protection compliance + retention policy
- [ ] Independent security review completed
- [ ] Dispute desk staffed for operating hours

---

## 5. Rollout gates (summary)

| Phase | Gate |
|---|---|
| 1. Testnet | No real fiat; train partners; drill disputes/reconciliation; no commercial claims |
| 2. Pilot prep | §4.8 checklist complete |
| 3. Kenya pilot | 50–200 users, 2–5 partners, ≤ $200/tx, conservative daily caps, 8–12 wks, defined stop conditions |
| 4. Wider commercial | UG/TZ as frameworks/sandboxes allow; higher limits + stronger controls |
| 5. API / multi-chain | Partner & merchant APIs; more chains/assets; USDC settlement retained |

---

## 6. Sources
See the companion research audit for full citations (Binance, Bybit, OKX, Bitget, KuCoin, Paxful, NoOnes, Yellow Card, Kotani Pay, HoneyCoin; MTN Uganda & Safaricom M-PESA tariffs; Stellar fee docs; Kenya VASP Act 2025 & draft Regs 2026; Bank of Uganda / BIS remarks; Bank of Tanzania sandbox & nTZS pilot). Re-verify all third-party fees and FX before launch.
