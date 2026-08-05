# Staging environment setup (phase-2/foundation)

**Branch:** `phase-2/foundation`  
**Goal:** Isolated staging stack for Phase 2 work (country registry, airtime, KYC tiers) without touching production data.

---

## Architecture

| Layer | Production (`master`) | Staging (`phase-2/foundation`) |
|-------|----------------------|--------------------------------|
| Backend | `rowan-1-9crb.onrender.com` | `rowan-backend-staging.onrender.com` (create) |
| Database | Supabase Postgres | **Neon Postgres** (new project) |
| Redis | Render Redis | **Same Render Redis as prod** (OK for testnet staging) |
| User app | rowan-nt9a.vercel.app | Vercel preview or staging project |
| Admin | rowan-dbb4.vercel.app | Vercel preview or staging project |

**Must differ:** `DATABASE_URL`, `API_URL`, `CORS_ORIGIN`, frontend `VITE_API_URL`.

**Can share with prod (testnet):** Render `REDIS_URL`, Stellar escrow keys, SEP-10 keys, Supabase storage, JWT secrets.

---

## Step 1 — Neon database

1. Go to [neon.tech](https://neon.tech) → New project → name `rowan-staging`
2. Copy connection string (pooled recommended):
   ```
   postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Migrations run automatically on backend boot (`042_countries_registry.sql` etc.)

---

## Redis (Render Key Value)

Production uses **Render internal Redis** (`redis://red-xxxx:6379`). That URL:

- **Works on Render** — staging backend service in the same workspace/region can reuse prod `REDIS_URL`
- **Does NOT work from your laptop** — internal hostnames are private-network only (DNS `ENOTFOUND` locally)

**Local dev options:**

1. **Deploy staging on Render first** (recommended) — no local Redis needed
2. **External URL** — Render Dashboard → Key Value → **Connect** → enable external → use `rediss://...` in local `.env` only
3. Skip local backend boot until Render staging is live


From repo root:

```powershell
cd backend
node scripts/bootstrap-staging-env.mjs
```

This creates `backend/.env.staging` by copying your existing `backend/.env` and overriding staging URLs.

Edit `backend/.env.staging`:

1. Paste **Neon** `DATABASE_URL`
2. Copy **Render** `REDIS_URL` from prod (Render dashboard → rowan-backend → Environment)
3. Update `API_URL` after Render staging deploy

**Use staging locally:**

```powershell
node scripts/bootstrap-staging-env.mjs --apply-local
```

Or manually: `copy .env.staging .env`

---

## Step 3 — Frontend env

```powershell
copy user-web\.env.staging.example user-web\.env
copy admin\.env.staging.example admin\.env
copy rowan-mobile\.env.staging.example rowan-mobile\.env
```

Update `VITE_API_URL` once staging Render URL is live.

---

## Step 4 — Render staging service

1. Render → New Web Service → same repo
2. **Branch:** `phase-2/foundation`
3. **Root directory:** `backend`
4. **Build:** `npm install`
5. **Start:** `npm start`
6. Paste all vars from `backend/.env.staging.example` (filled in)
7. Health check: `GET /health`

---

## Step 5 — Vercel staging

**Option A — Preview deploys (fastest)**  
Push to `phase-2/foundation`; Vercel preview gets a URL. Add that URL to backend `CORS_ORIGIN`.

**Option B — Dedicated staging project**  
New Vercel project, branch `phase-2/foundation`, env `VITE_API_URL=https://rowan-backend-staging.onrender.com`.

---

## Verify

```powershell
# Backend health
curl https://rowan-backend-staging.onrender.com/health

# Country registry (E1)
curl https://rowan-backend-staging.onrender.com/api/v1/countries
```

Expect JSON with UG, KE, TZ, RW.

---

## Files in repo (safe to commit)

| File | Purpose |
|------|---------|
| `backend/.env.staging.example` | Render / team reference |
| `user-web/.env.staging.example` | Vercel user app |
| `admin/.env.staging.example` | Vercel admin |
| `rowan-mobile/.env.staging.example` | Mobile builds |
| `backend/scripts/bootstrap-staging-env.mjs` | Generate local `.env.staging` |

**Never commit:** `backend/.env`, `backend/.env.staging`, or any file with real secrets.
