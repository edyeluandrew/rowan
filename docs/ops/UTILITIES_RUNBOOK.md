# Utilities ops runbook (Phase 2A)

**Scope:** Reloadly airtime/data + Utility Payments bills, USDC treasury, sandbox vs live.  
**Branch:** `phase-2/foundation`  
**Staging backend:** `https://rowan-backend-staging.onrender.com`

---

## Architecture (two Reloadly products)

| Product | Reloadly audience (sandbox) | Rowan use |
|---------|----------------------------|-----------|
| **Top-ups** | `https://topups-sandbox.reloadly.com` | Airtime, data bundles |
| **Utility Payments** | `https://utilities-sandbox.reloadly.com` | Electricity / bills |

Wallets are **separate**. Airtime balance does not pay bills.

Rowan holds user USDC in a **utility treasury** (`UTILITY_USDC_PUBLIC_KEY`). On purchase:

1. User sends USDC on Stellar (testnet or mainnet) with memo `ROWAN-UT-xxxx`
2. Backend verifies payment on Horizon
3. Backend calls Reloadly (top-up or utility pay)
4. Receipt stored; optional poll for prepaid token + kWh

---

## Environment variables (Render staging)

```env
# Shared Reloadly OAuth (sandbox credentials from dashboard)
RELOADLY_CLIENT_ID=...
RELOADLY_CLIENT_SECRET=...

# Stellar utility treasury (testnet)
UTILITY_USDC_PUBLIC_KEY=G...
UTILITY_USDC_SECRET_KEY=S...   # server-side only, never client

# Purchase behaviour
UTILITY_ALLOW_MOCK_PURCHASE=false          # require real USDC send
RELOADLY_UTILITIES_MOCK_MODE=false         # omit or false = real Reloadly utilities API
RELOADLY_UTILITIES_STAGING_FALLBACK=true   # default on testnet; simulated receipt if Reloadly biller down after USDC paid
STELLAR_NETWORK=testnet
```

| Flag | Effect |
|------|--------|
| `RELOADLY_UTILITIES_MOCK_MODE=true` | Skip Reloadly utilities API entirely (internal mock) |
| `RELOADLY_UTILITIES_STAGING_FALLBACK=false` | Fail purchase if Reloadly fails after USDC (don't simulate receipt) |
| `UTILITY_ALLOW_MOCK_PURCHASE=true` | Dev skip-payment button (don't use on staging demos) |

---

## Reloadly sandbox wallets (not real money)

1. Dashboard → **Sandbox ON** (orange toggle)
2. **Utility Payment** tab → balance + **Recharge wallet**
3. Fund with Reloadly **test cards** (see [Reloadly free test credit](https://support.reloadly.com/free-credit-for-testing))
4. **Top-ups wallet** is a different balance — fund both if testing airtime and bills

Sandbox deductions are **virtual USD**. Empty Reports with a lower balance can happen (card verification, wrong product filter).

---

## Known sandbox limitations (Jul 2026)

| Biller | Sandbox status |
|--------|----------------|
| **Kenya Electricity Prepaid** | Often fails: *"Could not retrieve/update resources"* (confirmed in Reloadly dashboard Pay) |
| **Uganda Umeme Prepaid** | Same class of failure |
| **Nigeria electricity** | Often works — use to verify wallet + API keys |

When Reloadly sandbox biller fails **after** USDC is already sent on testnet, Rowan completes with **staging fallback**: simulated customer name, units, token + yellow receipt note. USDC is not stuck.

Re-test KE/UG billers periodically; no Rowan code change needed when Reloadly restores them.

---

## Test: bills (Kenya example)

**Prerequisites:** Profile country = KE, Reloadly Utilities sandbox wallet funded, `UTILITY_ALLOW_MOCK_PURCHASE=false`.

1. `user-web/.env` → `VITE_API_URL=https://rowan-backend-staging.onrender.com`
2. Utilities → **Bills** → Kenya Electricity Prepaid
3. Meter: **11 digits** (e.g. `37171234567`)
4. Amount: **500–1,000 KES**
5. Confirm → send USDC → receipt

**Real Reloadly success:** no yellow fallback note; customer name + token from Reloadly; Utilities wallet balance drops.

**Staging fallback:** yellow note; `MOCK KENYA POWER CUSTOMER`; simulated token — Reloadly sandbox biller down (same error as dashboard Pay).

---

## Test: airtime / data

See [REAL_USDC_AIRTIME_TEST.md](./REAL_USDC_AIRTIME_TEST.md).

Data bundles: phone number → bundle picker → USDC send → Reloadly top-up API.

---

## Monitor utility treasury

```powershell
cd backend
npm run script:treasury-status   # if extended for utility treasury
```

On Horizon testnet ([stellar.expert](https://stellar.expert/explorer/testnet)):

- Watch `UTILITY_USDC_PUBLIC_KEY` for incoming USDC payments (memos `ROWAN-UT-*`)
- Compare inflows vs completed `utility_purchases` in DB

**Sweep / top-up:** reuse Circle faucet flow from [TESTNET_TREASURY_RUNBOOK.md](./TESTNET_TREASURY_RUNBOOK.md) for the utility treasury key when user test wallets need USDC.

---

## Production cutover checklist (later)

- [ ] Switch Reloadly to **live** credentials + live audiences
- [ ] Fund **live** Reloadly Utilities wallet (real USD)
- [ ] `STELLAR_NETWORK=mainnet`, utility treasury on mainnet USDC
- [ ] Set `RELOADLY_UTILITIES_STAGING_FALLBACK=false` on mainnet
- [ ] Re-test Kenya / Uganda billers on **live** Reloadly before marketing
- [ ] Alerting on failed utility purchases + treasury balance low

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Yellow fallback receipt | Reloadly sandbox biller unavailable | Confirm in Reloadly dashboard Pay; wait or contact Reloadly support |
| 400 insufficient balance | Utilities wallet empty | Recharge sandbox Utilities wallet |
| 404 `/billers` | Old backend deploy | Deploy latest `phase-2/foundation` |
| USDC sent, purchase failed hard | `RELOADLY_UTILITIES_STAGING_FALLBACK=false` | Re-enable fallback on testnet or refund manually |
| Airtime works, bills fail | Wrong wallet product | Fund **Utilities** wallet, not Top-ups only |
| `MOCK UMEME` on Kenya receipt | Old backend | Deploy backend with country-aware fallback labels |

---

## Related docs

- [REAL_USDC_AIRTIME_TEST.md](./REAL_USDC_AIRTIME_TEST.md)
- [TESTNET_TREASURY_RUNBOOK.md](./TESTNET_TREASURY_RUNBOOK.md)
- [05_UTILITIES_WALLET.md](../roadmap/05_UTILITIES_WALLET.md)
