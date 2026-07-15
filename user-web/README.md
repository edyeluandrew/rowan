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

### Auto-deploy on every push (Vercel)

`vercel.json` configures the build. **Git auto-deploy** is enabled in the Vercel dashboard:

1. [vercel.com](https://vercel.com) → **Add New Project** → import `edyeluandrew/rowan` (or your repo).
2. **Root Directory:** `user-web` (required — monorepo).
3. **Framework Preset:** Vite (or leave auto-detect).
4. **Production Branch:** `master`.
5. **Settings → Git →** ensure **Production Deployments** are enabled for that branch.

Every push to `master` that touches `user-web/` triggers a new deploy. Vercel reads `user-web/vercel.json` automatically.

**Auto-deploy not firing?** Check:

| Check | Where |
|-------|--------|
| Project linked to **GitHub** (not manual upload only) | Vercel → Project → Settings → Git |
| **Root Directory** = `user-web` | Settings → General |
| **Production Branch** = `master` | Settings → Git |
| New commit appears under **Deployments** after `git push` | Vercel → Deployments tab |

If you only ever used **Deploy manually**, create a **new** Vercel project from the GitHub repo with root `user-web`.

**Render (backend)** auto-deploy is separate: Render dashboard → `rowan-backend` → Settings → **Auto-Deploy** = Yes, connected to same GitHub repo (`master`). Pushes to `backend/` or root `render.yaml` trigger backend redeploys — not Vercel.

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
