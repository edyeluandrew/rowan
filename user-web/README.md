# Rowan User Web

Casual-user wallet on the browser — same API as the mobile app (**not** the trader dashboard).

## Features

- Create / import Stellar wallet (SEP-10 auth)
- Home (USDC balance)
- P2P Buy / Sell + Express
- Cashout & buy confirm flows
- History, disputes, profile

## Run locally

```bash
cd user-web
npm install
npm run dev
```

Opens on **http://localhost:5176**

Copy `.env.example` → `.env` and point `VITE_API_URL` at your backend.

## Deploy (Vercel / Render / Netlify)

Vite **bakes env vars in at build time**. A missing `VITE_API_URL` causes:

`Failed to fetch stellar.toml from localhost: Failed to fetch`

Set these in the host dashboard, then **redeploy**:

| Variable | Production value |
|----------|------------------|
| `VITE_API_URL` | `https://rowan-1-9crb.onrender.com` |
| `VITE_STELLAR_HORIZON_URL` | `https://horizon-testnet.stellar.org` |
| `VITE_STELLAR_NETWORK` | `testnet` |

**Do not** set `CORS_ORIGIN` on Vercel — the frontend ignores it. CORS is configured on the **Render backend**.

Also on **Render backend** → Environment:

- `API_URL` = same as above (used in `stellar.toml` `WEB_AUTH_ENDPOINT`)
- `CORS_ORIGIN` = your deployed user-web origin, e.g. `https://your-wallet.vercel.app` (comma-separate if multiple)

## Build

```bash
npm run build
npm run preview
```

## Note

This app was seeded from `rowan-mobile/src/wallet`. Biometrics and native push are no-ops / soft-skipped on web; payment proof upload uses the browser file picker where Camera is unavailable.
