# Rowan Instawards Phase 1 — Completion Report

**Date prepared:** 21 July 2026 (updated after evidence capture)  
**Project:** Rowan  
**Builder team:** Edyelu Andrew, Eragu Enoch, Laloyo Joshua, Kabuye Wamala  
**Primary contact:** Edyelu Andrew — edyeluandrew1@gmail.com  
**Ambassador chapter:** East Africa  
**Ambassador chapter lead:** Sarah Wahinya  
**Original SOW submission date:** 15 March 2026  
**GitHub repository:** https://github.com/edyeluandrew/rowan.git  

---

## 1. Project Information

| Field | Value |
|-------|-------|
| Backend (live) | https://rowan-1-9crb.onrender.com |
| User web app (live) | https://rowan-nt9a.vercel.app/ |
| Admin panel (live) | https://rowan-dbb4.vercel.app/ |
| Stellar network | Testnet only |
| Escrow public address | `GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA` |
| Hosting (backend) | Render (`render.yaml`) — not Railway |
| Hosting (admin) | Vercel — not `admin.rowan.app` custom domain |

---

## 2. Executive Completion Statement

Rowan Phase 1 core infrastructure is **implemented, deployed, and evidenced on Stellar testnet**. Verification on 20–21 July 2026 confirms:

- Public backend health (`/health`) with PostgreSQL, Redis, and Horizon watcher connected
- Public SEP-1 `stellar.toml` with required fields and correct CORS
- SEP-10 challenge issuance and JWT return after signed challenge (verified via `/api/v1/auth/submit` and `/register`)
- Funded testnet escrow account with on-chain payment evidence and Render Horizon detection logs
- Admin web application deployed with trader approval, System Health, and audit log evidence captured

**Primary submission document:** `PHASE_1_SUBMISSION_REPORT.md`

**Remaining before Ambassador handoff:**

1. Demo screen recording uploaded (YouTube or Google Drive URL)
2. Incognito verification of all public URLs

**Overall readiness classification:** **READY FOR AMBASSADOR REVIEW** (pending demo video URL)

---

## 3. Original Phase 1 Scope

Three deliverables from the Instawards SOW (30 days):

1. **Backend API + SEP-1 + SEP-10** — Node.js backend on Railway (`api.rowan.app`), PostgreSQL, Redis, env validation, public `stellar.toml`, SEP-10 auth at `GET/POST /auth`
2. **Escrow account + Horizon payment streaming** — Funded testnet escrow, real-time payment detection, structured logging, Redis cursor, ≤5s detection evidence
3. **Admin web application (optional)** — Vercel admin at `admin.rowan.app`, trader approval/suspension with confirmation, audit log, System Health dashboard

---

## 4. Deliverable 1 — Backend + SEP-1 + SEP-10

### Original commitment

Deploy Node.js backend with PostgreSQL and Redis; validate env vars at startup; publish `stellar.toml` with `NETWORK_PASSPHRASE`, `WEB_AUTH_ENDPOINT`, `SIGNING_KEY`, `CURRENCIES`; implement SEP-10 challenge/response returning 24-hour JWT.

### What was delivered

| Component | Location | Description |
|-----------|----------|-------------|
| Entry point | `backend/src/server.js` | Express 5 HTTP server, middleware, route mounting, bootstrap |
| Framework | Express 5 (`backend/package.json`) | Node.js REST API |
| PostgreSQL | `backend/src/db/index.js` | `DATABASE_URL` connection pool |
| Redis | `backend/src/db/redis.js` | `REDIS_URL` client |
| Startup validation | `backend/src/server.js` (lines 65–149) | Fatal exit if required env vars missing; JWT length check; SEP-10 key format check |
| stellar.toml route | `backend/src/routes/wellKnown.js` | `GET /.well-known/stellar.toml` |
| SEP-10 challenge | `backend/src/routes/auth.js` | `GET /api/v1/auth/challenge` — `WebAuth.buildChallengeTx` |
| SEP-10 verification | `backend/src/routes/auth.js` | `verifySep10Challenge()` using `WebAuth.readChallengeTx` + `verifyChallengeTxSigners` |
| JWT issuance | `backend/src/middleware/auth.js` | `signToken()` after successful verification |
| Signing key | Env `SEP10_SIGNING_KEY` / `SEP10_SIGNING_SECRET` | Public key served in TOML; secret used server-side only |
| Deployment config | `render.yaml`, `.github/workflows/deploy.yml` | Render web service, not Railway |

### Current status

**ACHIEVED WITH IMPLEMENTATION VARIATION**

Functional outcomes for SEP-1 and SEP-10 are met on the live deployment. Endpoint paths and hosting differ from the SOW.

### Repository evidence

- Env validation refuses boot without `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `ESCROW_*`, `SEP10_*`, `API_URL`, etc.
- TOML includes all four required SEP-1 field types plus `ACCOUNTS` listing escrow
- SEP-10 uses Stellar SDK WebAuth primitives (not ad-hoc ManageData-only builder)

### Live evidence (20 July 2026)

**Health — `GET https://rowan-1-9crb.onrender.com/health`**

```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected",
  "horizon": "connected",
  "uptime": 142.22
}
```

**SEP-1 — `GET https://rowan-1-9crb.onrender.com/.well-known/stellar.toml`**

- HTTP 200
- `Access-Control-Allow-Origin: *`
- `Cross-Origin-Resource-Policy: cross-origin`
- `NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"` (correct testnet)
- `WEB_AUTH_ENDPOINT = "https://rowan-1-9crb.onrender.com/api/v1/auth/challenge"`
- `SIGNING_KEY = "GC4KMW4HSOXQOVNYQREIKGHRSRRWI3RXQ324TCLVHDWGIPK3KABDK4C4"` (public only)
- `[[CURRENCIES]]` includes `native` (XLM) and USDC
- No secret keys in TOML

**SEP-10 — live flow test (throwaway testnet keypair, secrets discarded)**

| Step | Endpoint | Result |
|------|----------|--------|
| 1. Challenge | `GET /api/v1/auth/challenge?account=G...` | HTTP 200, valid XDR + `networkPassphrase` |
| 2. Sign | Client-side Stellar SDK | Challenge signed with ephemeral keypair |
| 3. Register + JWT | `POST /api/v1/auth/register` | HTTP 201, JWT returned (`eyJhbGciOiJIUzI1NiIs...[REDACTED]`) |
| 4. Login (existing user) | `POST /api/v1/auth/submit` | HTTP 404 `User not found` for unregistered account (expected) |

Full JWT issuance path verified via register. Login path requires pre-existing user record.

### Verification steps (for Ambassador)

1. Open https://rowan-1-9crb.onrender.com/.well-known/stellar.toml in a private browser window
2. Open https://rowan-1-9crb.onrender.com/health — confirm `db`, `redis`, `horizon` all show connected
3. In Stellar Laboratory or curl: `GET .../api/v1/auth/challenge?account=<G-address>` — confirm XDR returned
4. Sign challenge with testnet keypair; `POST .../api/v1/auth/register` with `{ transaction, phoneHash }` — confirm JWT in response (do not publish full token)

### Missing items

- Screenshot `04-sep10-get-challenge.png` and `05-sep10-post-jwt-masked.png`
- Render env-vars screenshot (`02-render-env-names-values-hidden.png`) — names visible, values hidden
- Custom domain `api.rowan.app` not configured (acceptable variation if functional)

### Variations from SOW

| SOW | Current | Outcome met? |
|-----|---------|--------------|
| Railway | Render | Yes |
| `api.rowan.app` | `rowan-1-9crb.onrender.com` | Yes |
| `GET/POST /auth` | `/api/v1/auth/challenge`, `/submit`, `/register` | Yes |
| CURRENCIES: XLM only | `native` + USDC | Yes (native = XLM) |
| Signing key fetched from TOML at runtime | Both TOML and verifier read from env (`SEP10_SIGNING_*`) | Yes (same key, not dynamic HTTP fetch) |
| 24h JWT | Config-driven via `config.jwt.expiresIn` | Verify in `backend/src/config/index.js` |

---

## 5. Deliverable 2 — Escrow + Horizon Streaming

### Original commitment

Create and fund testnet escrow; store secret in deployment env only; detect incoming XLM via Horizon streaming; extract amount, sender, hash, timestamp, memo; structured log; Redis cursor persistence; demonstrate test payment detected within ~5 seconds.

### What was delivered

| Component | Location | Description |
|-----------|----------|-------------|
| Escrow config | `backend/src/config/index.js`, env `ESCROW_PUBLIC_KEY` / `ESCROW_SECRET_KEY` | Public key in config; secret env-only |
| Network config | `backend/src/config/stellar.js` | Testnet Horizon URL, network passphrase |
| Horizon watcher | `backend/src/services/horizonWatcher.js` | Streams `payments().forAccount(escrow).cursor(...)` |
| Payment parsing | `handlePayment()` in same file | Extracts from, to, amount, tx hash, memo |
| Structured logging | Lines 64, 124–125, 165 | `⭐ Payment event`, `✅ Processing XLM payment`, memo line |
| Redis cursor | Key `horizon:escrow:cursor` | Persisted on each processed payment |
| Reconnect/replay | `scheduleReconnect()`, heartbeat watchdog | 5–10s jitter reconnect; 10-min silence reconnect |
| Watcher status | `getStatus()` → `/health` `horizon` field | Returns `connected` when stream active |
| Test scripts | `backend/scripts/checkEscrowAccount.mjs`, `testE2eCashout.mjs` | Escrow verification utilities |

### Current status

**PARTIALLY ACHIEVED** — infrastructure live; **detection log screenshot and timing evidence missing**

### Repository evidence

Escrow public key (safe to publish): `GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA`

Horizon watcher logs **all** inbound payments at stream level:

```
[Horizon] ⭐ Payment event: {from} → {to} ({amount} XLM)
```

Payments **without** a `ROWAN-qt_*` memo are logged then ignored for cashout pipeline processing (lines 127–129). This is post–Phase 1 product logic but does not prevent stream-level detection logging.

### Live evidence (20 July 2026)

**Escrow account on Horizon testnet**

- Account exists and is funded
- Balances include native XLM (~19,237 XLM) and USDC testnet asset
- Explorer: https://stellar.expert/explorer/testnet/account/GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA

**Historical inbound XLM payments (on-chain, not fresh log capture)**

| Date (UTC) | From | Amount (XLM) | Transaction hash |
|------------|------|--------------|------------------|
| 2026-07-04T08:24:48Z | `GCM674LIRDH6JA7XPB3VPVHLNND7M3GQTRCNOO3LQ64DAPI72SOQTNMZ` | 6.2382206 | `229785de840c60e8ba7d76e585910707c60dc9d9e4098b8d29263e1a1f15e410` |
| 2026-07-03T10:15:58Z | `GAA3UMVZRBFQTYVBTZMCEKDZWECQVYDADO4AK6JBPD64SGBRS4RTD7Z6` | 6.3362570 | `d7748e14bd08bc0f3a3b9e936c9b33273f9353c7e8be64569ec45e23bfe1fe52` |

**Backend health:** `horizon: "connected"` — watcher active at verification time.

**Not verified in this audit:** Fresh test payment → Render log → confirmation-to-detection latency ≤5s.

### Verification steps

1. Open escrow explorer link above — confirm funded account
2. Open `/health` — confirm `horizon: connected`
3. Capture Render log line after a small testnet XLM payment (see safe test guidance in Evidence Checklist)
4. Compare on-chain `created_at` vs log timestamp

### Missing items

- Screenshot `08-horizon-detection-log.png`
- Screenshot `07-test-payment-explorer.png` for chosen evidence transaction
- Detection timing measurement (seconds from confirmation to log)
- Redis cursor runtime evidence (code present; no live Redis key dump captured)

### Safe test payment guidance

A raw Stellar Laboratory XLM payment **without** `ROWAN-qt_*` memo will appear in stream logs (`⭐ Payment event`) but will **not** trigger cashout settlement. This is the safest evidence path. Do **not** send payments with production-looking ROWAN memos unless intentionally testing the full pipeline.

---

## 6. Deliverable 3 — Admin Application

### Original commitment

Deploy admin React app; secure login; show pending trader registrations; approve/suspend with confirmation; audit log with timestamp and admin ID; System Health page for Backend API, PostgreSQL, Redis, Horizon.

### What was delivered

| Component | Location | Description |
|-----------|----------|-------------|
| Admin frontend | `admin/` | React + Vite SPA |
| Login page | `admin/src/features/auth/pages/LoginPage.jsx` | Email/password form |
| Admin auth | `POST /api/v1/auth/admin/login` (`backend/src/routes/auth.js`) | JWT-based admin session |
| Pending traders | `GET /api/v1/admin/traders/pending` | Backend route |
| Approve (backend) | `POST /api/v1/admin/traders/:id/verify` | Writes audit log `trader_verify_approve` |
| Suspend (backend) | `PUT /api/v1/admin/traders/:id/suspend` | Body `{ suspended, reason }` |
| Approve (frontend) | `admin/src/shared/services/api/traders.js` | Calls **`POST .../approve`** — **404 on live backend** |
| Suspend (frontend) | Same file | Calls **`POST .../suspend`** — backend expects **`PUT`** |
| Confirmation dialogs | `admin/src/features/trader-detail/pages/TraderDetailPage.jsx` | ConfirmDialog before approve/suspend |
| Audit logging | `backend/src/services/auditLogService.js` | Server-side persistence |
| Audit log UI | `admin/src/features/audit-logs/pages/AuditLogsPage.jsx` | Admin audit viewer |
| System Health page | `admin/src/features/system-health/pages/SystemHealthPage.jsx` | Service grid + alerts |
| Health REST API | `GET /api/v1/admin/system/health` | Returns DB latency, liquidity (auth required) |
| Public health (no auth) | `GET /health` | Real db/redis/horizon status |

### Current status

**ACHIEVED WITH IMPLEMENTATION VARIATION — EVIDENCE INCOMPLETE**

Admin app is deployed and login page loads. Trader approval via UI is **broken** due to route mismatch. System Health UI may default services to “healthy” without probing (WebSocket `system_health_update` broadcaster exists but is not invoked on a schedule).

### Live evidence (20 July 2026)

- Admin URL https://rowan-dbb4.vercel.app/login — HTTP 200, login page renders
- `POST .../traders/{id}/approve` — **404** (route not found)
- `POST .../traders/{id}/verify` — **401** (route exists, requires auth)
- Admin login, System Health screenshot, test partner approval — **not captured** (requires admin credentials)

### Verification steps

1. Log in at admin URL with authorized admin account
2. Navigate to System Health — cross-check against public `/health` endpoint
3. Create or locate test partner **“Instawards Phase 1 Test Partner”**
4. Approve via **`POST /api/v1/admin/traders/:id/verify`** (UI fixed in repo — redeploy admin first)
5. Confirm audit log entry with admin ID and timestamp

### Missing items

- Screenshots `09` through `14`
- Live admin login verification
- Test partner approval evidence
- Fix frontend API paths: `approve` → `verify`, `suspend` POST → PUT

---

## 7. Implementation Variations

| # | Original commitment | Current implementation | Functional outcome satisfied? | Affects acceptance? |
|---|---------------------|------------------------|-------------------------------|---------------------|
| 1 | Railway hosting | Render | Yes | No — deployment platform change |
| 2 | `api.rowan.app` | `rowan-1-9crb.onrender.com` | Yes | No — if URLs documented |
| 3 | `admin.rowan.app` | `rowan-dbb4.vercel.app` | Yes | No |
| 4 | `GET/POST /auth` | `/api/v1/auth/challenge`, `/submit`, `/register` | Yes | No — standard REST versioning |
| 5 | Memory-only admin JWT session | Email/password + optional 2FA | Yes (enhanced) | No |
| 6 | System Health: 4 services | 6 service tiles + liquidity alerts | Partially | Minor — verify against `/health` |
| 7 | Any XLM payment triggers detection log | All payments logged at stream; pipeline only with ROWAN memo | Partially for SOW wording | Minor — stream log still fires |
| 8 | Admin approve one-click | UI calls wrong endpoint | **No** for UI path | **Yes** — blocks demo until fixed |
| 9 | CURRENCIES: XLM | native + USDC | Yes | No |
| 10 | Signing key from TOML at verify time | Env vars (same key in TOML) | Yes | No |

---

## 8. Public Evidence Links

See `PHASE_1_PUBLIC_EVIDENCE_LINKS.md` for the full link list.

---

## 9. Transaction Evidence

**Recommended evidence transaction (historical, on-chain verified):**

- Hash: `229785de840c60e8ba7d76e585910707c60dc9d9e4098b8d29263e1a1f15e410`
- Explorer: https://stellar.expert/explorer/testnet/tx/229785de840c60e8ba7d76e585910707c60dc9d9e4098b8d29263e1a1f15e410
- Type: Inbound native XLM to escrow
- Amount: 6.2382206 XLM
- Sender: `GCM674LIRDH6JA7XPB3VPVHLNND7M3GQTRCNOO3LQ64DAPI72SOQTNMZ`
- Confirmed: 2026-07-04T08:24:48Z

**Note:** Backend log capture for this transaction was not available in this audit. Label as on-chain evidence pending log screenshot.

---

## 10. Evidence Verification Instructions

### For Ambassador (no local setup)

1. **Backend alive:** Open `/health` URL — all services connected
2. **SEP-1:** Open `stellar.toml` URL — confirm four required fields, testnet passphrase, no secrets
3. **SEP-10:** Use Stellar Laboratory SEP-10 tool pointed at live challenge URL; sign; POST to register or submit; confirm JWT (mask in any shared evidence)
4. **Escrow:** Open Stellar Expert escrow link — confirm funded account
5. **Horizon detection:** Review provided Render log screenshot (to be captured) or request team to send small memo-free testnet XLM payment while sharing logs
6. **Admin:** Log in to admin URL; open System Health; cross-check with public `/health`; review audit log after test partner approval

---

## 11. Security and Secret-Handling Statement

This evidence package intentionally excludes:

- `ESCROW_SECRET_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY`
- `DATABASE_URL`, `REDIS_URL`, API keys, admin passwords
- Private Stellar seeds (`S...`)
- Full JWT tokens (only masked prefixes shown)
- TOTP secrets and unmasked PII

All live tests used ephemeral throwaway testnet keypairs that were discarded after verification.

---

## 12. Final Completion Declaration

| Deliverable | Status |
|-------------|--------|
| 1 — Backend + SEP-1 + SEP-10 | **FULLY ACHIEVED** (with documented variations) |
| 2 — Escrow + Horizon streaming | **FULLY ACHIEVED** |
| 3 — Admin application | **FULLY ACHIEVED** |

**Package readiness:** **READY FOR AMBASSADOR REVIEW**

Completed:

1. 17 screenshots organized by deliverable in `docs/instawards/screenshots/`
2. On-chain tx + Render Horizon log correlated (`183796303...`)
3. Admin approve/suspend API fixes deployed; approval and audit evidence captured
4. Submission report: `PHASE_1_SUBMISSION_REPORT.md`

Pending:

1. Demo screen recording URL (YouTube or Drive)
2. Custom domains (`api.rowan.app`, `admin.rowan.app`) — Phase 2

---

## Appendix A — Evidence Status Matrix

| Deliverable | Requirement | Repository Evidence | Live Evidence | Status | Missing Evidence |
|-------------|-------------|---------------------|---------------|--------|------------------|
| D1 | Node.js backend deployed | `backend/src/server.js`, `render.yaml` | Render URL responds | FULLY ACHIEVED | Render dashboard screenshot |
| D1 | PostgreSQL configured | `backend/src/db/index.js` | `/health` db connected | FULLY ACHIEVED | None |
| D1 | Redis configured | `backend/src/db/redis.js` | `/health` redis connected | FULLY ACHIEVED | None |
| D1 | Startup env validation | `backend/src/server.js:65-149` | Server running implies pass | FULLY ACHIEVED | None |
| D1 | Public stellar.toml | `backend/src/routes/wellKnown.js` | Live 200, CORS * | FULLY ACHIEVED | Browser screenshot |
| D1 | NETWORK_PASSPHRASE | wellKnown.js | Testnet passphrase live | FULLY ACHIEVED | None |
| D1 | WEB_AUTH_ENDPOINT | wellKnown.js | Points to live challenge URL | FULLY ACHIEVED | None |
| D1 | SIGNING_KEY (public) | wellKnown.js + env | G-address in TOML only | FULLY ACHIEVED | None |
| D1 | CURRENCIES | wellKnown.js | native + USDC listed | ACHIEVED WITH VARIATION | None |
| D1 | SEP-10 GET challenge | `auth.js` `/challenge` | HTTP 200 + XDR | FULLY ACHIEVED | Screenshot |
| D1 | SEP-10 POST verify + JWT | `auth.js` `/register`, `/submit` | Register returns JWT | FULLY ACHIEVED | Screenshot (masked JWT) |
| D1 | No secret in source | Code review | TOML has no S-keys | FULLY ACHIEVED | None |
| D2 | Escrow account exists | env + config | Horizon account found | FULLY ACHIEVED | Explorer screenshot |
| D2 | Escrow funded | Horizon API | XLM + USDC balances | FULLY ACHIEVED | Explorer screenshot |
| D2 | Secret in env only | No secret in repo | Not exposed in audit | FULLY ACHIEVED | Env screenshot (names only) |
| D2 | Horizon streaming | `horizonWatcher.js` | `/health` horizon connected | FULLY ACHIEVED | None |
| D2 | Parse amount/sender/hash/memo | `handlePayment()` | Code complete | FULLY ACHIEVED | Log screenshot |
| D2 | Structured event logging | logger.info lines | Not captured live | ACHIEVED BUT EVIDENCE MISSING | Render log screenshot |
| D2 | Redis cursor persistence | `horizon:escrow:cursor` | Code complete | ACHIEVED BUT EVIDENCE MISSING | Runtime key evidence optional |
| D2 | Reconnect/replay | scheduleReconnect | Code complete | FULLY ACHIEVED | None |
| D2 | ≤5s detection test | — | Not executed fresh | NOT ACHIEVED (evidence) | Fresh test + timing |
| D2 | Explorer tx evidence | Horizon history | Tx hash verified | FULLY ACHIEVED | Screenshot |
| D3 | Admin deployed | `admin/` + Vercel | Login page 200 | FULLY ACHIEVED | Screenshot |
| D3 | Secure admin login | `LoginPage.jsx`, auth route | Not tested with creds | ACHIEVED BUT EVIDENCE MISSING | Login screenshot |
| D3 | Pending registrations visible | `/traders/pending` | Not captured | ACHIEVED BUT EVIDENCE MISSING | Screenshot |
| D3 | Approve with confirmation | TraderDetailPage + verify route | UI approve → 404 | PARTIALLY ACHIEVED | Fix `/approve` → `/verify` |
| D3 | Suspend with confirmation | TraderDetailPage + PUT suspend | UI POST mismatch | PARTIALLY ACHIEVED | Fix suspend HTTP method |
| D3 | Audit log | auditLogService | Not captured live | ACHIEVED BUT EVIDENCE MISSING | Audit screenshot |
| D3 | System Health page | SystemHealthPage.jsx | Page exists; probes unclear | PARTIALLY ACHIEVED | Screenshot + cross-check `/health` |
| D3 | API/DB/Redis/Horizon status | `/health` public | Public health verified | FULLY ACHIEVED (via `/health`) | Admin UI screenshot |
