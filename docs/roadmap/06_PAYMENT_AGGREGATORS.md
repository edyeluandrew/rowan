# Category C — Payment Aggregators

**Document:** 06 of 12 | **Items:** C1–C11  
**Version:** 1.0 | **Date:** 24 July 2026  

---

## 1. Why aggregators

Manual P2P traders **do not scale** to 20+ African countries. Aggregators provide:
- Single API → many MoMo operators  
- Automated settlement  
- Compliance infrastructure (partially)  

Rowan uses a **hybrid model**: traders where you have relationships; aggregators everywhere else.

---

## 2. Provider comparison

| Provider | Best for | Crypto OK? | Typical fee | API type |
|----------|----------|------------|-------------|----------|
| **Yellow Pay (Yellow Card)** | On/off-ramp USDC↔fiat | Yes | 0.5–1.5% | REST API |
| **Onafriq (MFS Africa)** | Pan-African MoMo reach | Hard | 1.5–3% | REST API |
| **Flutterwave** | Bills, cards, bank NG/KE | Risky if crypto | 1.5–3% | REST API |
| **Reloadly** | Airtime/data/bills | N/A (utilities) | Per product | REST API |
| **Kotani Pay API** | Stellar MoMo rails | Yes | Negotiated | REST API |

### Recommendation
- **Core ramp:** Yellow Pay  
- **Utilities:** Reloadly (+ Flutterwave for NG/KE bills)  
- **Backup MoMo:** Onafriq  
- **Do not pitch Flutterwave as crypto ramp**

---

## 3. API vs SDK

| Use case | Use |
|----------|-----|
| Money movement (deposit, payout) | **REST API** from backend |
| KYC selfie capture | **SDK** (Smile ID) |
| User never sees aggregator brand | API only |

---

## 4. Aggregator onboarding requirements (Beta Tech Labs)

All providers typically require:

1. Certificate of Incorporation (URSB)  
2. MEMART  
3. Form 20 / directors  
4. Corporate TIN  
5. Corporate bank account  
6. AML/KYC policy document  
7. Expected monthly volume per country  
8. Description of business (see `00_EXECUTIVE_OVERVIEW.md` §9)  

**Timeline:** 2–12 weeks depending on provider and crypto honesty.

---

## 5. C2 — Aggregator abstraction layer

### Interface design

```javascript
// backend/src/services/payments/providers/PayoutProvider.js
class PayoutProvider {
  async sendPayout({ country, amount, currency, phone, reference }) {}
  async getPayoutStatus(reference) {}
}

// backend/src/services/payments/providers/DepositProvider.js
class DepositProvider {
  async initiateDeposit({ country, amount, currency, phone, reference }) {}
  async handleWebhook(payload) {}
}
```

### Implementations
- `YellowPayProvider.js`  
- `P2PTraderFallbackProvider.js` (existing manual flow)  
- `OnafriqProvider.js` (Phase 2C)  

### Routing (C9)

```javascript
// config/payment_routes.json
{
  "UG": { "offramp": ["yellow_pay", "p2p_trader"], "onramp": ["yellow_pay", "p2p_trader"] },
  "KE": { "offramp": ["yellow_pay", "p2p_trader"], "onramp": ["yellow_pay"] },
  "NG": { "offramp": ["yellow_pay"], "onramp": ["yellow_pay"] }
}
```

---

## 6. C1 — Yellow Pay integration steps

1. Apply at Yellow Card business portal as Beta Tech Labs  
2. Obtain sandbox API keys  
3. Implement deposit + collection endpoints  
4. Test UG or KE corridor  
5. Production keys after compliance review  
6. Wire into cashout/buy routes as alternative path  

---

## 7. C5 — Webhook handlers

New route: `POST /api/v1/webhooks/yellowpay`  
- Verify signature  
- Update transaction status  
- Credit USDC or mark payout complete  
- Idempotency keys required  

---

## 8. C6 — Fallback routing logic

```
User requests off-ramp
  → Try Yellow Pay (if country configured)
  → On failure/timeout → offer P2P trader match
  → Log which rail used for analytics
```

---

## 9. Fee economics

| Rail | Cost to Rowan | User experience |
|------|---------------|-----------------|
| P2P trader | Spread negotiated | Human trader, flexible amounts |
| Yellow Pay | ~1% + spread | Instant, fixed corridors |
| Reloadly utility | Product cost + 2–5% | No off-ramp needed |

---

## 10. Compliance note

**Smile ID / MetaMap does NOT make you AML-compliant alone.** Aggregators will ask for your AML policy (A3) and may audit your KYC flow. Transaction monitoring (A6) must run on your backend continuously.

---

*End Category C*
