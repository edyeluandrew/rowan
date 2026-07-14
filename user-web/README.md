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

Copy `.env.example` → `.env` and point `VITE_API_URL` at your backend (default in committed example uses Render for convenience — override for local backend).

## Build

```bash
npm run build
npm run preview
```

## Note

This app was seeded from `rowan-mobile/src/wallet`. Biometrics and native push are no-ops / soft-skipped on web; payment proof upload uses the browser file picker where Camera is unavailable.
