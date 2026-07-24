# Rowan Phase 1 — Public Evidence Links

**Prepared:** 21 July 2026  
**Security note:** Public URLs and public Stellar addresses only. No secrets, connection strings, passwords, or full JWTs.

---

## Live Services

| Resource | URL |
|----------|-----|
| GitHub repository | https://github.com/edyeluandrew/rowan.git |
| Backend API | https://rowan-1-9crb.onrender.com |
| Health check (public) | https://rowan-1-9crb.onrender.com/health |
| stellar.toml (SEP-1) | https://rowan-1-9crb.onrender.com/.well-known/stellar.toml |
| SEP-10 challenge (GET) | https://rowan-1-9crb.onrender.com/api/v1/auth/challenge?account=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX |
| SEP-10 login (POST) | https://rowan-1-9crb.onrender.com/api/v1/auth/submit |
| SEP-10 register (POST) | https://rowan-1-9crb.onrender.com/api/v1/auth/register |
| User web app | https://rowan-nt9a.vercel.app/ |
| Admin frontend | https://rowan-dbb4.vercel.app/ |
| Admin login | https://rowan-dbb4.vercel.app/login |
| Admin System Health (after login) | https://rowan-dbb4.vercel.app/system-health |

Replace `GXXX...` in the challenge URL with any valid 56-character Stellar public key starting with `G`.

---

## Demo Video

| Resource | URL |
|----------|-----|
| Phase 1 screen recording | _[TO BE ADDED — YouTube or Google Drive URL]_ |

Script: `docs/instawards/PHASE_1_SCREEN_RECORDING_SCRIPT.md`

---

## Source Code

| Resource | URL |
|----------|-----|
| Backend entry | https://github.com/edyeluandrew/rowan/blob/main/backend/src/server.js |
| stellar.toml route | https://github.com/edyeluandrew/rowan/blob/main/backend/src/routes/wellKnown.js |
| SEP-10 auth routes | https://github.com/edyeluandrew/rowan/blob/main/backend/src/routes/auth.js |
| Horizon watcher | https://github.com/edyeluandrew/rowan/blob/main/backend/src/services/horizonWatcher.js |
| Admin app | https://github.com/edyeluandrew/rowan/tree/main/admin |
| User web app | https://github.com/edyeluandrew/rowan/tree/main/user-web |
| Render deployment config | https://github.com/edyeluandrew/rowan/blob/main/render.yaml |

---

## Stellar Testnet — Escrow

| Resource | Value / URL |
|----------|-------------|
| Escrow public address | `GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA` |
| Escrow account (Stellar Expert) | https://stellar.expert/explorer/testnet/account/GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA |
| SEP-10 signing key (public) | `GC4KMW4HSOXQOVNYQREIKGHRSRRWI3RXQ324TCLVHDWGIPK3KABDK4C4` |
| Network passphrase | `Test SDF Network ; September 2015` |

---

## Transaction Evidence (Primary — On-Chain + Log Verified)

| Resource | Value / URL |
|----------|-------------|
| Evidence transaction hash | `183796303ae529608943bf4405f643eb31e6340e4ef15798a92340bc488930d7` |
| Explorer link | https://stellar.expert/explorer/testnet/tx/183796303ae529608943bf4405f643eb31e6340e4ef15798a92340bc488930d7 |
| Payment type | Inbound native XLM to escrow (no memo) |
| Amount | 0.1 XLM |
| Sender | `GBEMAXEUIZZCQHDP2CBOLFBAHY6KP5KAOJHH65PI2L2SRE4PJ6VUV4E2` |
| Confirmed (on-chain) | 2026-07-20T17:05:58 UTC |
| Backend log | `[Horizon] ⭐ Payment event: GBEMAX... → GCIRNEH... (0.1000000 XLM)` |
| Detection latency | <1 second |

**Screenshots:** `screenshots/deliverable-2-escrow-horizon/07-test-payment-explorer.png`, `08-horizon-detection-log.png`

---

## Evidence Screenshots (Local Repository)

| Deliverable | Folder | Files |
|-------------|--------|-------|
| D1 — Backend + SEP-1 + SEP-10 | `docs/instawards/screenshots/deliverable-1-backend-sep1-sep10/` | 01–05 (+ env parts 1–5) |
| D2 — Escrow + Horizon | `docs/instawards/screenshots/deliverable-2-escrow-horizon/` | 06–08 |
| D3 — Admin | `docs/instawards/screenshots/deliverable-3-admin/` | 10–14 |

Index: `docs/instawards/screenshots/README.md`

---

## Original SOW URLs (Not Active — Equivalents Above)

| Original SOW URL | Current equivalent |
|------------------|-------------------|
| https://api.rowan.app | https://rowan-1-9crb.onrender.com |
| https://admin.rowan.app | https://rowan-dbb4.vercel.app |

---

## Quick Verification (No Secrets)

```bash
curl -s https://rowan-1-9crb.onrender.com/health
curl -s https://rowan-1-9crb.onrender.com/.well-known/stellar.toml
curl -s "https://rowan-1-9crb.onrender.com/api/v1/auth/challenge?account=GCLFWZD56SRB4HCDN3MPGDFPDUC6DEC3UGVXAV53NQVXDMKXUXFFHIOG"
```
