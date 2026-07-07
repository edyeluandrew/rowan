# Testnet USDC Treasury Runbook

Guide for ops and devs: fund the Rowan **testnet treasury**, auto-fund tester wallets, and top up from Circle when USDC runs low.

**Testnet only.** Do not use this on mainnet.

---

## What this is

| Piece | Role |
|-------|------|
| **Treasury wallet** | `TESTNET_FAUCET_SECRET_KEY` — holds Circle testnet USDC |
| **Backend faucet** | `POST /api/v1/testnet/fund-usdc` — sends real USDC `payment` to new wallets |
| **Mobile app** | Auto trustline + requests faucet on wallet create |
| **Top-up script** | `backend/scripts/topUpTreasuryFromCircle.mjs` — fill treasury via Circle helper wallets |

Balances are always read from **Horizon** (not simulated).

**Circle testnet USDC issuer:** `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

---

## One-time setup (already done if treasury has USDC)

1. Generate a dedicated treasury keypair (Stellar Lab or `npm run script:genkey` in `backend/`).
2. Fund treasury `G...` with **Friendbot** (XLM for fees).
3. Add **USDC trustline** on treasury (Lab → Change Trust, issuer above).
4. Fund treasury with **Circle** → [faucet.circle.com](https://faucet.circle.com) → USDC → **Stellar Testnet**.
5. Set on **Render** (and local `backend/.env`):

```env
STELLAR_NETWORK=testnet
HORIZON_URL=https://horizon-testnet.stellar.org
TESTNET_FAUCET_SECRET_KEY=S...
TESTNET_FAUCET_USDC_AMOUNT=20
TESTNET_FAUCET_COOLDOWN_SECONDS=7200
```

6. Redeploy backend after env changes.

**Do not commit** `TESTNET_FAUCET_SECRET_KEY` to git.

---

## After every Render deploy — quick check

From `backend/` on your machine (with `.env` pointing at same treasury):

```bash
npm run script:treasury-status
```

Expect:

- `Network: testnet`
- `Treasury USDC:` > 0 (e.g. 920)
- `Rough capacity @ 20 USDC/tester:` enough for your pilot

**Smoke test (app):**

1. Testnet mobile build (`VITE_STELLAR_NETWORK=testnet`, `VITE_API_URL` = your Render API).
2. **Create a new wallet** (not an old one).
3. Home shows **~20 USDC** within a few seconds.
4. Optional: [stellar.expert testnet](https://stellar.expert/explorer/testnet) — payment treasury → new wallet.

If faucet fails:

- **503** → `TESTNET_FAUCET_SECRET_KEY` missing on Render.
- **0 USDC after create** → treasury empty or cooldown; check `treasury-status`.
- **Trustline error** → Friendbot/XLM issue on new wallet (retry “Get free test USDC” on Home).

---

## When to top up treasury

| Signal | Action |
|--------|--------|
| `treasury-status` USDC < **100** | Plan a top-up soon |
| New testers get **no USDC** on create | Top up now |
| Capacity < testers you’re inviting | Top up before pilot batch |

**Rule of thumb:** `treasury USDC ÷ 20` = max new wallets at 20 USDC each.

---

## Top up from Circle (automated script + manual Circle)

Circle cannot be scripted (website + limits). The script automates Stellar steps only.

### Commands (from `backend/`)

| Command | What it does |
|---------|----------------|
| `npm run script:treasury-prepare` | Create 10 helpers: Friendbot + USDC trustline |
| `npm run script:treasury-sweep` | Send helper USDC → treasury |
| `npm run script:treasury-status` | Treasury + helper balances |
| `node scripts/topUpTreasuryFromCircle.mjs prepare --count 10` | Same as prepare, custom count (1–50) |
| `node scripts/topUpTreasuryFromCircle.mjs circle-guide` | Print Circle instructions |

### Full round (~200 USDC per round with 10 helpers)

**Step 1 — Prepare**

```bash
cd backend
npm run script:treasury-prepare
```

Script prints **10 helper `G...` addresses**. Helper secrets are stored locally in `backend/scripts/.treasury-helpers.json` (gitignored).

**Step 2 — Circle (manual, browser)**

For **each** helper address printed:

1. Open [https://faucet.circle.com/](https://faucet.circle.com/)
2. Asset: **USDC**
3. Network: **Stellar Testnet** (not Ethereum)
4. Paste helper **`G...`**
5. Click **Send / Get tokens** (~20 USDC)
6. Repeat for all 10 addresses

**Step 3 — Sweep**

```bash
npm run script:treasury-sweep
```

Moves USDC from funded helpers into your treasury.

**Step 4 — Verify**

```bash
npm run script:treasury-status
```

Repeat prepare → Circle → sweep until treasury has enough (e.g. 5 rounds ≈ 1000 USDC).

### If sweep says `wait (0 USDC)`

That helper was not funded on Circle yet. Fund it on Circle, then run `sweep` again.

---

## Tester experience (no Circle for them)

1. Create wallet in app.
2. App sets USDC trustline (automatic).
3. App calls backend faucet → **20 USDC** from treasury.
4. Home shows balance from Horizon.

If balance is empty: Home → **Get 20 free test USDC** (retry).

---

## Render env checklist

Ensure these exist on the **backend** service:

- `STELLAR_NETWORK=testnet`
- `TESTNET_FAUCET_SECRET_KEY` (treasury secret)
- `TESTNET_FAUCET_USDC_AMOUNT=20` (optional)
- `DATABASE_URL`, `REDIS_URL`, `ESCROW_*`, `JWT_SECRET`, etc. (unchanged)

Mobile app env:

- `VITE_STELLAR_NETWORK=testnet`
- `VITE_API_URL=https://your-render-api.onrender.com`

---

## Production note

On **mainnet**:

- No Friendbot, no testnet faucet, no auto free USDC.
- Keep **auto USDC trustline** on wallet create.
- Users get USDC via **Buy**, **Receive**, or **Refund** only.

See [MAINNET_CUTOVER_CHECKLIST](./MAINNET_CUTOVER_CHECKLIST.md).

---

## Quick reference

```
Treasury low?
  → prepare --count 10
  → Circle: fund each helper G...
  → sweep
  → treasury-status

New deploy?
  → treasury-status
  → create one test wallet in app

Tester stuck at 0 USDC?
  → treasury-status
  → top up if needed
  → "Get free test USDC" on Home
```
