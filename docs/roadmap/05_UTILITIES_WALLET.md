# Category B — Utilities & Wallet

**Document:** 05 of 12 | **Items:** B1–B13  
**Version:** 1.0 | **Date:** 24 July 2026  

---

## Strategic rationale

Utilities convert Rowan from a **pass-through ramp** into a **daily-use wallet**. Target order: **airtime → bills → savings → virtual cards**.

---

## B1 — USDC Balance Wallet UI

Show:
- **Available** — spendable USDC  
- **Locked** — in active P2P trades  
- **Savings** — in savings product (Phase 2B)  

Surfaces: `user-web`, `rowan-mobile`

---

## B2–B7 — Airtime & Bill Payments (Phase 2A MVP)

### Recommended provider: Reloadly

| Feature | Reloadly | Flutterwave |
|---------|----------|-------------|
| Airtime | Yes, pan-African | Yes |
| Data bundles | Yes | Limited |
| Bill pay | Yes | Yes (strong in NG/KE) |
| Crypto sensitivity | Low (digital commerce) | Medium |
| Integration | REST API | REST API |

**Hybrid approach:** Reloadly for Phase 2A MVP; add Flutterwave for NG/KE bill depth in 2B.

### Backend architecture (new modules)

```
backend/src/services/utilities/
  reloadlyClient.js      # API wrapper
  utilityService.js        # Business logic
  utilityPricing.js        # USDC amount + FX + fee

backend/src/routes/utilities.js
  GET  /api/v1/utilities/providers?country=UG&type=airtime
  GET  /api/v1/utilities/products?provider=mtn_ug
  POST /api/v1/utilities/purchase
  GET  /api/v1/utilities/history
```

### Purchase flow
1. User selects country + provider + amount  
2. Backend quotes USDC cost (FX + margin)  
3. User confirms; backend checks Tier limit + USDC balance  
4. Deduct USDC from user (ledger or escrow sub-account)  
5. Call Reloadly API  
6. Store receipt; push notification  

### Database (new tables)
- `utility_providers`  
- `utility_purchases` (id, user_id, type, provider, amount_fiat, amount_usdc, status, external_ref)  

### Frontend
- New "Utilities" tab: Airtime | Data | Bills  
- Provider logos (MTN, Airtel, UMEME, etc.)  
- Receipt screen with reference number  

---

## B8–B10 — Savings & Yield (Phase 2B)

### Product framing
**"Digital Dollar Savings"** — not "DeFi yield farming."

### Option A: Stellar native AMM
- User deposits USDC into pool  
- Earns trading fees  
- Requires Soroban/AMM integration + legal review  

### Option B: Partner yield API
- Third party holds USDC; Rowan shows balance  
- Faster launch; higher counterparty risk  

### Legal
Get Ugandan counsel opinion before displaying APY. May require different product license.

### UI
- Savings tab with balance + "Add funds" / "Withdraw"  
- Simple APY display if approved  

---

## B11–B13 — Virtual USD Cards (Phase 2C)

### Provider candidates
| Provider | Strength |
|----------|----------|
| Maplerad | Africa-focused virtual cards |
| Bridge | USDC-native card funding |

### Requirements
- Tier 2 KYC minimum  
- Corporate partnership under Beta Tech Labs  
- Card top-up debits USDC wallet  

### Features
- Create virtual card  
- View card number (masked) + CVV (secure reveal)  
- Top up from USDC  
- Transaction list  

---

## Fee model (indicative)

| Utility | User fee | Rowan margin |
|---------|----------|--------------|
| Airtime | 0–1% USDC | FX spread 0.5–1% |
| Bills | 1–2% | Provider cost + margin |
| Savings | 0% deposit | Share of yield if applicable |
| Virtual card | $1–2 create | Interchange share |

---

## Differentiation vs Kotani/Pretium

| They | Rowan |
|------|-------|
| Off-ramp then user buys airtime elsewhere | One-tap airtime from USDC |
| No savings | Digital dollar savings |
| No global card | Virtual USD card (Phase 2C) |

---

*End Category B*
