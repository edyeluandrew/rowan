# Category E — Multi-Country Expansion

**Document:** 08 of 12 | **Items:** E1–E6  
**Version:** 1.0 | **Date:** 24 July 2026  

---

## E1 — Country Registry (Critical refactor)

### Problem
Countries hardcoded in:
- `rowan-mobile/src/wallet/utils/constants.js`  
- `backend/src/services/fx/fxProviders.js`  
- `backend/src/services/fraudMonitor.js`  

### Solution
New table `countries`:
```sql
countries (
  code CHAR(2) PRIMARY KEY,  -- UG, KE, TZ, RW
  name TEXT,
  currency_code CHAR(3),
  active BOOLEAN,
  kyc_config JSONB,
  payment_config JSONB
)
```

New table `payment_methods`:
```sql
payment_methods (
  id, country_code, type, provider, network_code, active
)
```

Load at startup; admin can toggle corridors.

---

## E2 — Per-Country KYC Rules

JSON in `countries.kyc_config`:
```json
{
  "tier1_daily_usd": 50,
  "tier2_daily_usd": 1000,
  "smile_id_job_type": "NIN_UG",
  "required_docs": ["national_id"]
}
```

---

## E3 — Per-Country Payment Methods

JSON in `countries.payment_config`:
```json
{
  "momo_networks": ["mtn", "airtel"],
  "default_offramp_provider": "yellow_pay",
  "fallback_provider": "p2p_trader"
}
```

---

## E4 — FX Rate Formalization

- Document primary FX source per corridor  
- Admin override endpoint  
- Stale rate alert if >30 min old  

Existing: `backend/src/services/fx/fxProviders.js`

---

## E5 — Localization (Phase 3)

- Swahili for KE/TZ  
- i18n in `user-web` and `rowan-mobile`  

---

## E6 — West Africa Expansion Pack

Checklist per country:
- [ ] Yellow Pay corridor available  
- [ ] Smile ID ID type configured  
- [ ] Local payment methods in registry  
- [ ] FX source  
- [ ] Legal review  
- [ ] Pilot traders or aggregator-only  

Target: Nigeria, Ghana first in West Africa.

---

## Country rollout matrix

| Country | Currency | Phase | Rail strategy |
|---------|----------|-------|---------------|
| Uganda | UGX | Live | P2P + Yellow Pay |
| Kenya | KES | Live | P2P + Yellow Pay |
| Tanzania | TZS | Live | P2P + Yellow Pay |
| Rwanda | RWF | 2B | P2P + Yellow Pay |
| Nigeria | NGN | 2C | Aggregator-first |
| Ghana | GHS | 2C | Aggregator-first |

---

*End Category E*
