# Rowan — Phase Timeline & Sequencing

**Document:** 03 of 12  
**Version:** 1.0 | **Date:** 24 July 2026  
**Font (print):** Times New Roman, 12pt  

---

## 1. Overview

This timeline assumes a **small team (4 builders)** working alongside existing Rowan maintenance. Durations are indicative — adjust based on funding and aggregator approval timelines (bank + Yellow Pay can take 2–8 weeks alone).

```
2026 Q3          2026 Q4          2027 Q1          2027 Q2+
│ Phase 2A       │ Phase 2B       │ Phase 2C       │ Phase 3
│ Foundation +   │ Aggregators +  │ Cards + WA     │ CCTP + B2B
│ Bill Pay       │ Savings        │ expansion      │
```

---

## 2. Phase 2A — Foundation + First Utility (Weeks 1–12)

**Goal:** Legal readiness + first reason to keep USDC in Rowan (airtime/bills).

### Week 1–2: Corporate & compliance paperwork

| Task | IDs | Owner suggestion | Output |
|------|-----|------------------|--------|
| Confirm URA TIN | A2 | Edyelu / ops | TIN certificate |
| Open corporate bank account | A1 | Edyelu + directors | Stanbic/Ecobank account |
| Draft AML/CFT policy | A3 | Edyelu + legal review | 5–10 page PDF |
| Open Smile ID sandbox | A5 | Backend dev | API keys |
| Open Reloadly sandbox | B2 | Backend dev | API keys |

### Week 3–4: KYC & country refactor

| Task | IDs | Output |
|------|-----|--------|
| Implement tiered KYC limits in API | A4 | Middleware enforces Tier 1/2/3 |
| Smile ID SDK in mobile/web | A5 | ID verify flow |
| Country registry refactor | E1 | DB/config replaces hardcoded constants |
| Uptime monitoring | G2 | Public status page |

### Week 5–8: Airtime & bill pay MVP

| Task | IDs | Output |
|------|-----|--------|
| USDC balance UI polish | B1 | Clear spendable balance |
| Reloadly backend service | B2, B6 | `utilityService.js` |
| Utility checkout API + UI | B5 | End-to-end airtime purchase |
| Data bundles | B3 | Same pipeline |
| Bill payments (1–2 providers) | B4 | Electricity or TV test |
| Transaction history | B7 | Utilities category |

### Week 9–12: Test, pilot, document

| Task | IDs | Output |
|------|-----|--------|
| Partner MoU with 2 traders | G4 | Signed pilots |
| Internal QA + testnet → mainnet plan | — | Launch checklist |
| Flutterwave sandbox (utilities track) | C8 | Separate merchant account |
| Alerting runbook | G3 | Ops doc |

**Phase 2A exit criteria:**
- [ ] Beta Tech Labs bank account active  
- [ ] AML policy written  
- [ ] Smile ID Tier 2 live in sandbox  
- [ ] User can buy airtime with USDC in app  
- [ ] Country registry supports UG/KE/TZ + RW scaffold  

---

## 3. Phase 2B — Aggregators + Savings (Weeks 13–24)

**Goal:** Automated rails + retention (savings); reduce trader ops burden.

### Week 13–16: Yellow Pay integration

| Task | IDs | Output |
|------|-----|--------|
| Aggregator abstraction layer | C2 | Provider interfaces |
| Yellow Pay sandbox | C1 | Deposit + payout test |
| Webhook handlers | C5 | Callback routes |
| Automated off-ramp MVP | C3 | One corridor (e.g. UG) |
| Automated on-ramp MVP | C4 | One corridor |

### Week 17–20: Hybrid routing + Rwanda

| Task | IDs | Output |
|------|-----|--------|
| P2P fallback when aggregator fails | C6 | Routing logic |
| Per-country provider config | C9 | Admin or config file |
| Rwanda traders + config | A9, D1 | RW live |
| Transaction monitoring v2 | A6 | Auto-freeze rules |
| Trader dashboard | D2 | Admin/trader UI |

### Week 21–24: Savings + compliance depth

| Task | IDs | Output |
|------|-----|--------|
| USDC savings product UI | B8, B10 | Savings account |
| Yield integration (AMM or partner) | B9 | Legal-reviewed APY display |
| STR workflow | A7 | Admin export |
| Custom domains | G1 | api/admin/app.rowan.app |
| Per-country KYC rules | E2, E3 | Config per country |

**Phase 2B exit criteria:**
- [ ] At least 1 automated aggregator corridor live  
- [ ] P2P fallback tested  
- [ ] Savings product in beta  
- [ ] Rwanda traders onboarded  
- [ ] STR process documented  

---

## 4. Phase 2C — Premium + West Africa (Weeks 25–36)

**Goal:** Virtual cards, West Africa corridors, merchant scale.

| Task | IDs | Output |
|------|-----|--------|
| Virtual USD card | B11–B13 | Card in app |
| Onafriq backup rails | C7 | Secondary provider |
| Nigeria corridor | C10 | NGN |
| Ghana corridor | C11 | GHS |
| West Africa playbook | E6 | Launch checklist |
| Trader utility commissions | D5 | Optional |

**Phase 2C exit criteria:**
- [ ] Virtual card beta (Tier 2 users)  
- [ ] NG or GH corridor live via Yellow Pay  
- [ ] 4+ countries operational  

---

## 5. Phase 3 — Cross-Chain + B2B (Week 37+)

| Task | IDs | Output |
|------|-----|--------|
| CCTP POC | F1, F2 | Stellar → Base test |
| Multi-chain receive | F3, F4 | EVM deposit path |
| B2B merchant accounts | G5 | Business onboarding |
| Bulk payout API | G6 | Payroll use case |
| Merchant-agent model | D3 | Shop-based liquidity |
| Localization | E5 | Swahili UI |

---

## 6. Dependency Graph (Critical Path)

```
A2 TIN → A1 Bank → A3 AML → A5 Smile ID
                              ↓
E1 Country registry → B6 USDC debit → B2 Airtime
                              ↓
A1 Bank → C1 Yellow Pay → C2 Abstraction → C3/C4 Auto ramp
                              ↓
B8 Savings → B9 Yield (legal) → B11 Virtual card
                              ↓
F1 CCTP (only after Stellar mainnet product stable)
```

---

## 7. Parallel Workstreams

Teams can parallelize:

| Stream | Focus | Can start |
|--------|-------|-----------|
| **Ops/Legal** | A1, A2, A3, G4 | Immediately |
| **Backend platform** | E1, A4, A6, C2 | Week 1 |
| **Utilities** | B2–B7 | Week 3 (after E1 scaffold) |
| **Mobile/UI** | B1, B5, Smile ID UX | Week 3 |
| **Aggregators** | C1–C6 | Week 13 (after bank) |
| **Cross-chain** | F1–F4 | Phase 3 only |

---

## 8. External Timeline Risks

| Risk | Typical delay | Mitigation |
|------|---------------|------------|
| Corporate bank account approval | 1–3 weeks | Apply immediately; use MoMo merchant line interim |
| Yellow Pay compliance review | 4–12 weeks | Apply early with honest crypto use case |
| Smile ID production keys | 1–2 weeks | Sandbox first |
| Flutterwave crypto sensitivity | Account freeze risk | Separate utilities merchant; no crypto in description |
| Legal review for yield product | 2–6 weeks | Start before B9 build |

---

*Next: Category deep-dives in Documents 04–10, or `12_IMPLEMENTATION_STARTER.md` to pick first sprint.*
