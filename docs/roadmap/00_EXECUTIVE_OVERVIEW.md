# Rowan — Executive Overview

**Document:** 00 of 12  
**Version:** 1.0 | **Date:** 24 July 2026  
**Font (print):** Times New Roman, 12pt  

---

## 1. Company & Product

| Field | Detail |
|-------|--------|
| Legal entity | Beta Tech Labs Company Limited |
| Registration | Uganda Registration Services Bureau (URSB) |
| Product name | Rowan |
| Product registration | Operates under Beta Tech Labs (trading name / product line) |
| Tagline direction | *The digital dollar wallet for East Africa* |
| Core problem | Africans receiving USDC/XLM cannot easily spend, save, or convert without friction, fees, and app-hopping |
| Primary blockchain | Stellar (USDC native, low fees, fast settlement) |
| Planned expansion chain | EVM (Base, Arbitrum) via Circle CCTP — Phase 3 only |

---

## 2. What Phase 1 Delivered (Complete)

Phase 1 Instawards foundation is **submitted** with evidence. Do not rebuild these:

1. **Backend API** — Node.js on Render, PostgreSQL, Redis, env validation  
2. **SEP-1** — Public `stellar.toml` with testnet passphrase, WEB_AUTH, SIGNING_KEY, CURRENCIES  
3. **SEP-10** — Challenge/response authentication returning JWT  
4. **Escrow + Horizon** — Funded testnet escrow, real-time payment streaming, Redis cursor  
5. **Admin application** — Trader approval, System Health, audit log  

Evidence package: `docs/instawards/` (17 screenshots, submission report, public links).

---

## 3. What Phase 2 Must Deliver (Strategic)

Phase 2 transforms Rowan from a **conversion corridor** into a **financial remote control** — users receive USDC and can do more than send/receive:

| Pillar | Outcome |
|--------|---------|
| **Spend** | Pay airtime, data, and utility bills directly from USDC balance |
| **Save** | Hold USDC in a savings product (inflation hedge vs local currency) |
| **Convert** | Off-ramp to mobile money via verified P2P traders **or** automated aggregator rails |
| **Comply** | Tiered KYC, Smile ID, AML policy, transaction monitoring |
| **Scale** | Country registry, Rwanda, aggregator APIs for corridors beyond manual traders |

Phase 2C adds virtual USD cards. Phase 3 adds cross-chain and B2B treasury.

---

## 4. B2C vs B2B — Primary Strategy

| Dimension | B2C (Primary — Phase 2) | B2B (Secondary — Phase 3) |
|-----------|-------------------------|---------------------------|
| Customer | Freelancers, remittance receivers, gig workers | Importers, payroll platforms, crypto businesses |
| Transaction size | Small to medium ($10–$1,000) | Large ($1,000–$100,000+) |
| Sales cycle | Instant (app download) | Weeks to months (contracts) |
| Rowan fit today | P2P traders + utilities + savings | Requires aggregator bulk rails |
| Marketing | Viral, word of mouth, trader networks | Direct sales, partnerships |

**Decision:** Launch utilities and retention features for **B2C first**. Introduce B2B merchant accounts after automated fiat rails (Yellow Pay) are live in at least three countries.

---

## 5. Competitive Positioning

| Competitor | Their strength | Rowan differentiation |
|------------|----------------|----------------------|
| **Kotani Pay** | Stellar-native MoMo rails, brand recognition | Hold-and-spend utilities; verified trader escrow; admin audit trail |
| **Pretium** | East Africa off-ramp focus | USDC savings + bill pay without leaving app |
| **Yellow Card** | Licensed crypto exchange + B2B API | Consumer UX layer on top; P2P + aggregator hybrid |
| **Transak / Ramp** | Global embedded ramps | Africa-native: local ID, MoMo, airtime, Swahili-ready UX |

**One-line positioning:**  
*Rowan is the digital dollar wallet for East Africa — receive USDC, off-ramp to MoMo, or spend it on airtime, bills, and savings without multiple apps.*

---

## 6. Why Pure Send/Receive Is Not Enough

1. **Low margin trap** — P2P spread competition with MoMo giants (MTN, M-Pesa) compresses fees.  
2. **Double fee problem** — User off-ramps to fiat, then pays again for airtime/bills.  
3. **No retention** — User leaves app immediately after conversion.  
4. **Commodity risk** — Without utilities, Rowan is interchangeable with every other ramp.

Utilities (bill pay, savings) create **daily touchpoints** and **reasons to keep USDC in Rowan**.

---

## 7. Geographic Scope

### Current (operational / scaffolded)

- Uganda (UGX) — MTN MoMo, Airtel Money  
- Kenya (KES) — M-Pesa  
- Tanzania (TZS) — Vodacom, Tigo  

### Near-term (Phase 2A–2B)

- Rwanda (RWF) — MTN MoMo Rwanda  

### Mid-term (Phase 2C)

- Nigeria (NGN), Ghana (GHS) via Yellow Pay / Onafriq  

### Long-term (Phase 3)

- Pan-African coverage through aggregator network, not manual traders in every country  

---

## 8. Hybrid Rails Architecture (Target State)

```
                    ┌─────────────────────────┐
                    │     ROWAN USER APP      │
                    │  (USDC balance + utils) │
                    └───────────┬─────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │  P2P TRADERS │    │  YELLOW PAY  │    │ RELOADLY /   │
   │  (UG/KE/TZ/RW)│    │  (on/off-ramp)│    │ FLUTTERWAVE  │
   │  Large/custom │    │  Auto MoMo   │    │ (utilities)  │
   └──────────────┘    └──────────────┘    └──────────────┘
```

- **East Africa (now):** P2P traders for cashout/cashin where relationships exist.  
- **Expansion corridors:** Yellow Pay API for automated fiat without recruiting traders.  
- **Utilities:** Separate commerce API track (Reloadly/Flutterwave) — not mixed with crypto backend in aggregator pitches.

---

## 9. Regulatory Framing (Beta Tech Labs)

When opening bank accounts or applying to aggregators:

| Context | Recommended description |
|---------|-------------------------|
| Bank account opening | Software development, information technology, digital platform management |
| Traditional aggregator (Flutterwave) | Digital wallet providing cross-border payment infrastructure and utility payments for East African users |
| Crypto-native aggregator (Yellow Pay) | Stablecoin wallet on Stellar requiring B2B fiat liquidity API for mobile money corridors |
| Avoid | "P2P crypto exchange," "unregulated trading platform" |

AML compliance requires **technology (Smile ID) + policy (AML doc) + monitoring (backend rules)** — not any single vendor alone.

---

## 10. Success Metrics (Phase 2)

| Metric | Target (indicative) |
|--------|---------------------|
| Utility transactions / month | 500+ within 90 days of bill pay launch |
| USDC balance held (avg) | Increase 40% vs off-ramp-only cohort |
| Off-ramp completion time | <15 min (P2P), <5 min (aggregator path) |
| KYC Tier 2 conversion | 30% of active users within 60 days |
| Countries live | 4 (UG, KE, TZ, RW) by end Phase 2B |
| Aggregator corridors | 2+ automated by end Phase 2B |

---

## 11. Document Navigation

| Next read | Purpose |
|-----------|---------|
| `01_CURRENT_STATE.md` | Honest codebase assessment |
| `02_MASTER_BUILD_LIST.md` | Full itemized build list (55 items) |
| `12_IMPLEMENTATION_STARTER.md` | Pick first sprint |

---

*End of Document 00*
