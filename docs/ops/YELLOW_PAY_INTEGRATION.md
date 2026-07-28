# Yellow Pay integration (Phase 2 C1/C9)

**Goal:** Automated MoMo cash-in/cash-out via Yellow Card, with P2P traders as fallback.  
**Five launch corridors:** UG, KE, TZ, RW, NG, GH  
**Utilities:** Reloadly (separate rail — unchanged)

---

## Architecture

```text
User quote (cashout/buy)
    → paymentRouter.resolvePaymentPlan(country, side)
        1. yellow_pay  (automated — YellowPayProvider)
        2. p2p_trader  (existing matchingEngine flow)
```

| Component | Path |
|-----------|------|
| Provider constants | `backend/src/services/payments/paymentConstants.js` |
| Router (C9) | `backend/src/services/payments/paymentRouter.js` |
| Yellow client | `backend/src/services/payments/providers/yellowPayProvider.js` |
| Country config | `countries.payment_config` (migration 046) |
| Routes API | `GET /api/v1/payments/routes` |
| Webhook | `POST /api/v1/webhooks/yellowpay` |
| Tx columns | `payout_provider`, `aggregator_ref` (migration 047) |

---

## Environment (staging)

```env
YELLOW_PAY_ENABLED=true
YELLOW_PAY_CORRIDORS=UG,KE,TZ,RW,NG,GH
# When keys absent on testnet → mock mode (simulated payout refs)
YELLOW_PAY_CLIENT_ID=...
YELLOW_PAY_CLIENT_SECRET=...
YELLOW_PAY_WEBHOOK_SECRET=...
```

Run migrations **046** and **047** on Neon staging, then restart Render.

---

## Verify routing (no auth)

```bash
curl "https://rowan-backend-staging.onrender.com/api/v1/payments/routes?country=KE&side=offramp"
curl "https://rowan-backend-staging.onrender.com/api/v1/payments/providers/status"
```

Expected offramp plan:

- `primary.id`: `yellow_pay` (mock: true until real keys)
- `fallbackChain`: includes `p2p_trader`

Cashout/buy quote responses now include `paymentPlan`.

---

## What's implemented (this PR)

- [x] Payment router + Yellow Pay client (mock sandbox)
- [x] Five countries in DB + NG/GH networks
- [x] Quotes skip `NO_TRADERS` when Yellow corridor available
- [x] Post-deposit: `paymentExecutor.settleOfframpPayout` → Yellow Pay, P2P fallback
- [x] Tx columns: `payout_provider`, `aggregator_ref`, `payment_rail`
- [x] Webhook: match by `aggregator_ref`, notify on payout completion
- [x] User confirm → `releaseToSettlement` when `payout_provider=yellow_pay`
- [x] Frontend: "Payout via Yellow Pay" on cashout quote
- [x] Frontend NG/GH country + network constants

## Next build slices

- [ ] Wire buy onramp: `initiateDeposit` + webhook → credit USDC
- [ ] Webhook HMAC signature verification (real keys)
- [ ] Real Yellow Pay sandbox keys + end-to-end test per corridor
- [ ] Set `YELLOW_PAY_SETTLEMENT_STELLAR` on staging for full Yellow offramp completion

---

## Apply for Yellow Pay

1. [Yellow Card business portal](https://yellowcard.io) — Beta Tech Labs  
2. Sandbox keys → Render env  
3. Test KE corridor first, then enable NG/GH when compliance clears  

See also: [`06_PAYMENT_AGGREGATORS.md`](../roadmap/06_PAYMENT_AGGREGATORS.md)
