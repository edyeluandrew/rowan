# Real USDC airtime test (staging)

**Goal:** Simulate production — user pays real testnet USDC on-chain; Reloadly stays mock until sandbox keys are added.

**Branch:** `phase-2/foundation`  
**Backend:** `https://rowan-backend-staging.onrender.com`

---

## Prerequisites

| Item | Value |
|------|--------|
| Render `UTILITY_ALLOW_MOCK_PURCHASE` | **`false`** (disables skip-payment path) |
| Render `TESTNET_FAUCET_SECRET_KEY` | Same treasury as prod (fund via Circle script) |
| Render `CORS_ORIGIN` | Include `http://localhost:5176` (or your Vite port) |
| `user-web/.env` | `VITE_API_URL=https://rowan-backend-staging.onrender.com` |

Treasury top-up (from `backend/`):

```powershell
npm run script:treasury-status
npm run script:treasury-prepare
# Fund each helper G... on https://faucet.circle.com (USDC, Stellar Testnet)
npm run script:treasury-sweep
```

---

## Wallet setup

1. Clear stale prod session: DevTools → Application → Local Storage → delete `rowan_token`
2. Create/register wallet on **staging** (Neon DB user)
3. **Receive** → **Set up network fees** (Friendbot XLM)
4. **Home** → wait for test USDC faucet (~100 USDC) or tap retry

---

## Test flow

1. `cd user-web && npm run dev` → open localhost URL
2. Console: `[Client] BaseURL: https://rowan-backend-staging.onrender.com`
3. **Home → Airtime**
4. Amount + network + phone → **Get quote**
5. **Confirm** → button should say **Send USDC & buy airtime** (not "Complete test purchase")
6. Sign transaction → receipt with real `paymentTxHash`

---

## Verify success

| Check | Expected |
|-------|----------|
| Wallet USDC | Decreases by quote `usdcAmount` |
| Receipt | `paymentTxHash` starts with Stellar tx id (not `MOCK-`) |
| [stellar.expert testnet](https://stellar.expert/explorer/testnet) | Payment to treasury with memo `ROWAN-UT-xxxx` |
| History tab | Airtime purchase appears under Utilities |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Complete test purchase" button | Set `UTILITY_ALLOW_MOCK_PURCHASE=false` on Render |
| 403 on API | Fresh wallet on staging; clear old `rowan_token` |
| Insufficient USDC | Top up treasury + faucet wallet |
| Quote expired | Get new quote within 5 minutes |
| CORS error | Add localhost port to `CORS_ORIGIN` |

---

## After Reloadly sandbox keys

Set on Render:

```env
RELOADLY_CLIENT_ID=...
RELOADLY_CLIENT_SECRET=...
```

Keep `UTILITY_ALLOW_MOCK_PURCHASE=false` for full E2E including real top-up delivery.
