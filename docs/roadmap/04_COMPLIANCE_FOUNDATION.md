# Category A — Compliance & Foundation

**Document:** 04 of 12 | **Items:** A1–A9  
**Version:** 1.0 | **Date:** 24 July 2026  

---

## A1 — Corporate Bank Account

**Priority:** Critical | **Phase:** 2A  

### Objective
Open a corporate bank account for Beta Tech Labs Company Limited to receive aggregator settlements and pay operational expenses.

### Recommended banks (Uganda)
1. **Stanbic Bank Uganda** — fintech-friendly, aggregator settlement experience  
2. **Ecobank Uganda** — pan-African cross-border focus  
3. **Absa Bank Uganda** — solid corporate API options  

### Documents required
- URSB Certificate of Incorporation  
- Memorandum & Articles of Association  
- Form 20 (Directors)  
- URA TIN  
- Director IDs/passports  
- Board resolution to open account  

### Business description (for bank forms)
*"Software development, information technology services, and digital platform management."*  
Do **not** lead with "crypto exchange" at retail branch level.

### Acceptance criteria
- [ ] Account active in company name  
- [ ] Online banking (Velocity or equivalent) enabled  
- [ ] Signatories documented  

---

## A2 — URA Corporate TIN

**Priority:** Critical | **Phase:** 2A  

Apply via Uganda Revenue Authority portal if not already issued. Mandatory for bank and aggregator onboarding.

---

## A3 — AML/CFT Policy Document

**Priority:** Critical | **Phase:** 2A  

### Must include
1. Company overview and appointed compliance officer  
2. Customer due diligence (CDD) procedures  
3. Tiered KYC limits (see A4)  
4. Sanctions and PEP screening process  
5. Transaction monitoring rules  
6. Suspicious transaction reporting (STR) to Uganda FIA  
7. Record retention (minimum 5 years)  
8. Training schedule for staff  

### Template structure
1. Introduction  
2. Legal framework (AML Act Uganda, etc.)  
3. Risk assessment  
4. KYC tiers  
5. Ongoing monitoring  
6. STR procedure  
7. Data protection  
8. Review cycle (annual)  

---

## A4 — Tiered KYC Product Rules

**Priority:** High | **Phase:** 2A  

### Proposed tiers

| Tier | Verification | Daily limit (indicative) | Unlocks |
|------|--------------|--------------------------|---------|
| 1 | Phone OTP + full name | $50 | Small off-ramp, airtime |
| 2 | National ID + selfie (Smile ID) | $1,000 | Full off-ramp, savings |
| 3 | Address + source of funds | Custom | B2B, high volume |

### Backend work
- Extend `backend/src/config/index.js` tier definitions  
- Middleware on cashout, buy, utility routes  
- Admin override for edge cases  

### Existing code to extend
- `backend/src/routes/user.js` — KYC routes  
- `backend/src/services/fraudMonitor.js` — velocity caps  

---

## A5 — Smile ID Integration

**Priority:** High | **Phase:** 2A  

### Why Smile ID over MetaMap
- Stronger African ID database coverage (UG, KE, TZ, RW, NG)  
- Optimized mobile selfie capture on low-end devices  

### Integration points
- **SDK:** Mobile (`rowan-mobile`) + web (`user-web`) for selfie + ID capture  
- **API:** Backend webhook for verification result  
- **Admin:** Smile ID status on KYC submissions page  

### Country configurations
| Country | ID type |
|---------|---------|
| Uganda | NIN (NIRA) |
| Kenya | National ID / IPRS |
| Tanzania | NIDA |
| Rwanda | National ID |

### Sandbox first
Apply at https://usesmileid.com with Beta Tech Labs registration documents.

---

## A6 — Transaction Monitoring Upgrades

**Priority:** High | **Phase:** 2B  

### Rules to implement
- Tier limit exceeded → block + notify  
- >3 off-ramps same amount in 1 hour → flag  
- New account + max tier transaction → hold for review  
- Sanctions hit → instant freeze  

### Extend
- `backend/src/services/fraudMonitor.js`  
- New table: `compliance_flags`  
- Admin UI: compliance queue  

---

## A7 — STR / Suspicious Activity Workflow

**Priority:** Medium | **Phase:** 2B  

Admin can mark transaction/user → generate STR export → manual submit to FIA. Full automation not required in Phase 2B.

---

## A8 — Data Protection Registration

**Priority:** Medium | **Phase:** 2B  

Register with Uganda Personal Data Protection Office. Repeat per country when launching NG, GH, etc.

---

## A9 — Rwanda Country Config

**Priority:** Medium | **Phase:** 2B  

Add RWF, MTN MoMo Rwanda to country registry (E1), payout settings, and trader onboarding flows.

---

*End Category A — See `06_PAYMENT_AGGREGATORS.md` for aggregator compliance requirements.*
