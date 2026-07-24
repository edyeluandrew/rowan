# Implementation Starter Guide

**Document:** 12 of 12  
**Version:** 1.0 | **Date:** 24 July 2026  

---

## Before writing code

1. Read `00_EXECUTIVE_OVERVIEW.md`  
2. Read `01_CURRENT_STATE.md`  
3. Skim `02_MASTER_BUILD_LIST.md`  
4. Confirm open decisions in `11_DECISION_RECORD.md` with team  

---

## Recommended first sprint (choose one track)

### Track A — Ops/Legal (no code, unblocks everything)

**Duration:** 2–4 weeks  
**Items:** A1, A2, A3, G4  

| Week | Action |
|------|--------|
| 1 | Apply URA TIN if missing; gather URSB docs |
| 1 | Walk into Stanbic corporate banking with document pack |
| 2 | Draft AML/CFT policy (use `04_COMPLIANCE_FOUNDATION.md` outline) |
| 2 | Apply Smile ID + Reloadly sandbox (Beta Tech Labs details) |
| 3–4 | Finalize trader MoU template; open Yellow Pay application |

**Exit:** Bank account pending/active; AML draft; sandbox API keys.

---

### Track B — Engineering (parallel if ops running)

**Duration:** 4–6 weeks  
**Items:** E1, A4, B1, B2, B5, B6  

| Week | Action |
|------|--------|
| 1–2 | Country registry tables + migration (E1) |
| 2 | Tier middleware on routes (A4) |
| 3 | Reloadly client + utility routes (B2, B6) |
| 4 | Utility UI in user-web (B5) |
| 5 | Airtime E2E test on testnet USDC |
| 6 | QA + pilot with 5 users |

**Exit:** User buys airtime with USDC in staging.

---

### Track C — Compliance tech

**Duration:** 3–4 weeks  
**Items:** A5, A4, A6  

| Week | Action |
|------|--------|
| 1 | Smile ID sandbox integration |
| 2 | Wire into existing KYC submission flow |
| 3 | Tier limits + fraud monitor linkage |
| 4 | Admin compliance queue UI |

---

## Decision matrix: what to start with?

| If your priority is… | Start with track |
|----------------------|------------------|
| Unlock Yellow Pay / banks | **Track A** |
| Show investors/users new feature fast | **Track B** |
| Reduce regulatory risk before scale | **Track C** |
| Limited team (2 devs) | **A week 1, then B week 3** |

---

## Sprint 0 checklist (this week)

- [ ] Team meeting: confirm Track A vs B vs C  
- [ ] Assign owner for bank account application (A1)  
- [ ] Assign owner for AML draft (A3)  
- [ ] Create GitHub project board with all 55 items  
- [ ] Label items: `phase-2a`, `compliance`, `utilities`, `aggregators`  
- [ ] Do **not** start CCTP (F1–F4) or virtual cards (B11) yet  

---

## GitHub project board columns (suggested)

```
Backlog → Phase 2A → In Progress → Review → Done → Phase 2B → Phase 2C → Phase 3
```

---

## Files to create in first engineering sprint

```
backend/src/db/migrations/XXXX_countries_registry.sql
backend/src/services/countries/countryService.js
backend/src/services/utilities/reloadlyClient.js
backend/src/services/utilities/utilityService.js
backend/src/routes/utilities.js
user-web/src/features/utilities/
```

---

## What NOT to do first

| Avoid | Why |
|-------|-----|
| Nigeria launch | Need aggregator + compliance depth |
| CCTP / EVM | Phase 3; distracts from utilities |
| Virtual cards | Needs Tier 2 KYC + card partner |
| Replace all P2P with Yellow Pay | Hybrid; traders still valuable in EAC |
| Rewrite Phase 1 backend | Foundation is done |

---

## After first sprint — tell the team

Reply with:
1. Which track you chose (A, B, or C)  
2. Any open decision from `11_DECISION_RECORD.md`  
3. Target date for first airtime purchase demo  

We will then write the **detailed technical spec + implementation tasks** for that track only.

---

*End of roadmap document set. Master index: `README.md`. Print version: `ROWAN_ROADMAP_PRINT.html`.*
