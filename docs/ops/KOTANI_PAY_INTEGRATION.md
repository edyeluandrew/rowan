# Kotani Pay integration (Phase 2)

**Sandbox base URL:** `https://sandbox-api.kotanipay.io`  
**API prefix:** `/api/v3`  
**Docs:** [docs.kotanipay.com](https://docs.kotanipay.com/reference/endpoints-1)

Rowan uses Kotani as the **primary automated MoMo rail** when sandbox/production keys are configured. P2P traders remain the fallback.

---

## Step 1 — Get credentials from Kotani sandbox portal

1. Log into the **Kotani Pay integrator dashboard** (sandbox invite email).
2. Complete login / 2FA if prompted.
3. Copy your **JWT access token** from the portal (Developer / API section), **or** generate an API key via:
   - `GET /api/v3/auth/api-key/secure` (requires Bearer JWT from portal session)
4. Note your integrator **Stellar USDC wallet** address in the portal (Wallets → Crypto).

You need at minimum:

| Credential | Env var |
|------------|---------|
| JWT or API key | `KOTANI_PAY_JWT` or `KOTANI_PAY_API_KEY` |
| Rowan escrow public key (sender) | `KOTANI_PAY_SENDER_STELLAR` → same as `ESCROW_PUBLIC_KEY` on testnet |

---

## Step 2 — Add to local `backend/.env`

```env
KOTANI_PAY_ENABLED=true
KOTANI_PAY_BASE_URL=https://sandbox-api.kotanipay.io
KOTANI_PAY_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
KOTANI_PAY_SENDER_STELLAR=G...   # Rowan escrow public key
KOTANI_PAY_CALLBACK_URL=https://rowan-backend-staging.onrender.com/api/v1/webhooks/kotani
KOTANI_PAY_CORRIDORS=UG,KE,TZ,RW,NG,GH
```

Restart backend after saving.

---

## Step 3 — Add to Render staging

In **rowan-backend-staging** → Environment, add the same vars (use staging URL for callback).

Redeploy and verify:

```bash
curl "https://rowan-backend-staging.onrender.com/api/v1/payments/providers/status"
```

Expect:

```json
"kotaniPay": { "configured": true, "mockMode": false }
```

```bash
curl "https://rowan-backend-staging.onrender.com/api/v1/payments/routes?country=KE&side=offramp"
```

Expect `"primary": { "id": "kotani_pay", "mock": false }`.

---

## Step 4 — Run migration 048

```bash
psql "$DATABASE_URL" -f backend/src/db/migrations/048_kotani_pay_primary_routing.sql
```

Sets `kotani_pay` before `p2p_trader` in `countries.payment_config`.

---

## Step 5 — Register webhook in Kotani portal

**Callback URL:**

```text
https://rowan-backend-staging.onrender.com/api/v1/webhooks/kotani
```

Use the same URL as `KOTANI_PAY_CALLBACK_URL` when creating offramps.

---

## How offramp works (Rowan + Kotani)

```text
User sends USDC → Rowan escrow (ESCROW_LOCKED)
    → POST /api/v3/offramp (phone, cryptoAmount, STELLAR, USDC)
    → Kotani returns escrowAddress + referenceId
    → Rowan sends USDC escrow → Kotani escrowAddress
    → FIAT_PAYOUT_SUBMITTED
    → Kotani pays user MoMo
    → Webhook / callback → notify user
    → User confirms receipt → COMPLETE
```

---

## Test corridor order

1. **Kenya (KE)** — M-Pesa, `MPESA` network provider  
2. **Uganda (UG)** — MTN / Airtel  
3. TZ, RW when sandbox balances allow  

Start with a **small USDC amount** (e.g. 1–2 USDC).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `mockMode: true` | Set `KOTANI_PAY_JWT` or `KOTANI_PAY_API_KEY` |
| 401 Unauthorized | JWT expired — regenerate from Kotani portal |
| Offramp fails network | Check `networkProvider` matches Kotani enum (MTN, AIRTEL, MPESA) |
| No MoMo received | Confirm USDC reached Kotani `escrowAddress` on Stellar testnet |
| Falls back to P2P | Kotani call failed — check Render logs `[KotaniPay]` |

---

## Code map

| Piece | Path |
|-------|------|
| Provider client | `backend/src/services/payments/providers/kotaniPayProvider.js` |
| Settlement executor | `backend/src/services/payments/paymentExecutor.js` |
| Webhook | `backend/src/services/payments/webhooks/kotani.js` |
| Router | `backend/src/services/payments/paymentRouter.js` |
