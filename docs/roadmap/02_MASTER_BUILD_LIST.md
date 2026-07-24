# Rowan — Master Build List (55 Items)

**Document:** 02 of 12  
**Version:** 1.0 | **Date:** 24 July 2026  
**Font (print):** Times New Roman, 12pt  

---

## Legend

| Priority | Meaning |
|----------|---------|
| **Critical** | Blocks aggregator onboarding or legal operation |
| **High** | Core Phase 2A/2B deliverable |
| **Medium** | Important but can follow first utility launch |
| **Low** | Phase 2C or Phase 3 |

| Status | Meaning |
|--------|---------|
| **Done** | Exists in codebase (Phase 1 or prior) |
| **Partial** | Scaffolded; needs completion |
| **Not started** | Net-new build |

| Phase | Timeline (indicative) |
|-------|----------------------|
| 2A | Weeks 1–12 |
| 2B | Weeks 13–24 |
| 2C | Weeks 25–36 |
| 3 | Weeks 37+ |

---

## Category A — Compliance & Foundation (9 items)

| ID | Build item | Description | Status | Priority | Phase | Depends on |
|----|------------|-------------|--------|----------|-------|------------|
| A1 | Corporate bank account | Open Stanbic or Ecobank account for Beta Tech Labs | Not started | Critical | 2A | URSB docs |
| A2 | URA corporate TIN | Tax identification for company | Verify | Critical | 2A | — |
| A3 | AML/CFT policy document | Written policy: tiers, limits, STR process, FIA reporting | Not started | Critical | 2A | — |
| A4 | Tiered KYC product rules | Enforce Tier 1/2/3 limits in backend middleware | Partial | High | 2A | A3 |
| A5 | Smile ID integration | SDK + API for NIN/IPRS/ID verification per country | Not started | High | 2A | A3 |
| A6 | Transaction monitoring upgrades | Auto-freeze: velocity spikes, structuring, corridor abuse | Partial | High | 2B | A4 |
| A7 | STR / suspicious activity workflow | Admin UI + export for FIA reporting | Not started | Medium | 2B | A3, A6 |
| A8 | Data protection registration | Uganda DPA; per-country as expanded | Not started | Medium | 2B | — |
| A9 | Rwanda country config | RWF, MTN MoMo RW in constants + payout settings | Not started | Medium | 2B | E1 |

---

## Category B — Utilities & Wallet (13 items)

| ID | Build item | Description | Status | Priority | Phase | Depends on |
|----|------------|-------------|--------|----------|-------|------------|
| B1 | USDC balance wallet UI | Clear available vs locked balance | Partial | High | 2A | — |
| B2 | Airtime purchase | USDC → MTN/Airtel airtime via Reloadly | Not started | High | 2A | B6, C8 or Reloadly |
| B3 | Data bundles | Mobile data packages same pipeline as airtime | Not started | High | 2A | B2 |
| B4 | Bill payments | Electricity, TV, water via utility API | Not started | High | 2A | B6 |
| B5 | Utility checkout flow | Provider picker → amount → confirm → receipt | Not started | High | 2A | B2 |
| B6 | USDC debit for utilities | Backend: deduct USDC, settle fiat to provider | Not started | High | 2A | A4 |
| B7 | Utility transaction history | Category filter in user tx list | Not started | Medium | 2A | B5 |
| B8 | USDC savings account | "Digital dollar savings" product surface | Not started | Medium | 2B | B1 |
| B9 | Yield integration | Stellar AMM or partner yield on USDC | Not started | Medium | 2B | B8, legal review |
| B10 | Savings deposit/withdraw | Move USDC between wallet and savings | Not started | Medium | 2B | B8 |
| B11 | Virtual USD card issuance | Maplerad/Bridge card API | Not started | Low | 2C | A5 Tier 2 |
| B12 | Card top-up from USDC | Fund virtual card from wallet | Not started | Low | 2C | B11 |
| B13 | Card transaction history | Online spend tracking | Not started | Low | 2C | B11 |

---

## Category C — Payment Aggregators (11 items)

| ID | Build item | Description | Status | Priority | Phase | Depends on |
|----|------------|-------------|--------|----------|-------|------------|
| C1 | Yellow Pay sandbox | Crypto-native on/off-ramp API integration | Not started | High | 2B | A1, A3 |
| C2 | Aggregator abstraction layer | `PayoutProvider` / `DepositProvider` interfaces | Not started | High | 2B | — |
| C3 | Automated off-ramp path | User MoMo payout without manual trader | Not started | High | 2B | C1, C2 |
| C4 | Automated on-ramp path | MoMo deposit → USDC credit | Not started | High | 2B | C1, C2 |
| C5 | Aggregator webhooks | Payment confirmed / failed callbacks | Not started | High | 2B | C1 |
| C6 | Fallback routing | Yellow Pay primary; P2P trader fallback | Not started | Medium | 2B | C3, D1 |
| C7 | Onafriq integration | Backup pan-African MoMo gateway | Not started | Medium | 2C | A1, C2 |
| C8 | Flutterwave integration | Utilities + bank (separate from crypto pitch) | Not started | Medium | 2A/2B | A1 |
| C9 | Per-country provider config | Map UG/KE/TZ/RW → provider + method | Not started | Medium | 2B | E1, C2 |
| C10 | Nigeria corridor (NGN) | Yellow Pay or dedicated NG provider | Not started | Low | 2C | C1 |
| C11 | Ghana corridor (GHS) | Same pattern as C10 | Not started | Low | 2C | C1 |

---

## Category D — P2P Trader Upgrades (6 items)

| ID | Build item | Description | Status | Priority | Phase | Depends on |
|----|------------|-------------|--------|----------|-------|------------|
| D1 | Rwanda trader support | RW onboarding, MoMo networks, limits | Not started | Medium | 2B | E1, A9 |
| D2 | Trader liquidity dashboard | Float, corridor stats, performance | Not started | Medium | 2B | — |
| D3 | Merchant-agent model | Retail shops as liquidity nodes | Not started | Low | 3 | D2 |
| D4 | Automated payout verification | Carrier reference / webhook where available | Not started | Medium | 2B | — |
| D5 | Trader utility referral commission | Optional rev share on bill pay | Not started | Low | 2C | B2 |
| D6 | Dispute reduction | Better proof-of-payment, fewer screenshot disputes | Not started | Medium | 2B | D4 |

---

## Category E — Multi-Country Expansion (6 items)

| ID | Build item | Description | Status | Priority | Phase | Depends on |
|----|------------|-------------|--------|----------|-------|------------|
| E1 | Country registry (config-driven) | Replace hardcoded UG/KE/TZ constants | Not started | High | 2A | — |
| E2 | Per-country KYC rules | Different tiers/limits per jurisdiction | Not started | High | 2B | E1, A5 |
| E3 | Per-country payment methods | MoMo networks from DB/config | Not started | High | 2B | E1 |
| E4 | FX rate source formalization | Document + admin override per corridor | Partial | Medium | 2B | E1 |
| E5 | Localized UI (languages) | Swahili, etc. | Not started | Low | 3 | — |
| E6 | West Africa expansion pack | NG, GH, CI launch checklist | Not started | Low | 2C/3 | C10, C11 |

---

## Category F — Cross-Chain & CCTP (4 items)

| ID | Build item | Description | Status | Priority | Phase | Depends on |
|----|------------|-------------|--------|----------|-------|------------|
| F1 | CCTP research + POC | Stellar USDC burn → EVM mint test | Not started | Low | 3 | Stellar mainnet stable |
| F2 | Wormhole/LayerZero SDK | Use existing SDK; do not write bridge contracts | Not started | Low | 3 | F1 |
| F3 | Multi-chain USDC receive | User selects destination chain | Not started | Low | 3 | F2 |
| F4 | EVM deposit detection | Webhook/indexer for Base/Arbitrum deposits | Not started | Low | 3 | F2 |

---

## Category G — Platform & Operations (6 items)

| ID | Build item | Description | Status | Priority | Phase | Depends on |
|----|------------|-------------|--------|----------|-------|------------|
| G1 | Custom domains | api.rowan.app, admin.rowan.app, app.rowan.app | Not started | Medium | 2B | — |
| G2 | External uptime monitoring | UptimeRobot / Better Stack | Not started | Medium | 2A | — |
| G3 | Production alerting runbook | Escalation when services down | Partial | Medium | 2A | G2 |
| G4 | Partner MoU templates | Formal trader / pilot agreements | Partial | Medium | 2A | — |
| G5 | B2B merchant accounts | Separate onboarding for businesses | Not started | Low | 3 | C3, C4 |
| G6 | B2B bulk payout API | Payroll / supplier batch payments | Not started | Low | 3 | G5, C2 |

---

## Summary by Category

| Category | Items | Critical/High | Not started |
|----------|-------|---------------|-------------|
| A — Compliance | 9 | 5 | 7 |
| B — Utilities | 13 | 7 | 12 |
| C — Aggregators | 11 | 6 | 11 |
| D — P2P upgrades | 6 | 0 | 5 |
| E — Multi-country | 6 | 3 | 5 |
| F — Cross-chain | 4 | 0 | 4 |
| G — Platform ops | 6 | 0 | 4 |
| **Total** | **55** | **21** | **48** |

---

## Summary by Phase

| Phase | Item IDs | Count |
|-------|----------|-------|
| 2A | A1–A5, B1–B7, E1, G2–G4, (C8 partial) | ~18 |
| 2B | A6–A9, B8–B10, C1–C6, C9, D1–D2, D4, D6, E2–E4, G1 | ~14 |
| 2C | B11–B13, C7, C10–C11, D5, E6 | ~15 |
| 3 | D3, E5, F1–F4, G5–G6 | ~8 |

---

*Detailed specs per category: Documents 04–10. Sequencing: `03_PHASE_TIMELINE.md`.*
