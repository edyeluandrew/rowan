# Rowan Phase 1 — Public Evidence Links

**Prepared:** 20 July 2026  
**Security note:** This file contains **public URLs and public Stellar addresses only**. No secrets, connection strings, passwords, or full JWTs.

---

## Live Services

| Resource | URL |
|----------|-----|
| Backend API | https://rowan-1-9crb.onrender.com |
| Health check (public) | https://rowan-1-9crb.onrender.com/health |
| stellar.toml (SEP-1) | https://rowan-1-9crb.onrender.com/.well-known/stellar.toml |
| SEP-10 challenge (GET) | https://rowan-1-9crb.onrender.com/api/v1/auth/challenge?account=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX |
| SEP-10 login verify (POST) | https://rowan-1-9crb.onrender.com/api/v1/auth/submit |
| SEP-10 register verify (POST) | https://rowan-1-9crb.onrender.com/api/v1/auth/register |
| Admin frontend | https://rowan-dbb4.vercel.app/login |
| Admin System Health (after login) | https://rowan-dbb4.vercel.app/system-health |

Replace `GXXX...` in the challenge URL with any valid 56-character Stellar public key starting with `G`.

---

## Source Code

| Resource | URL |
|----------|-----|
| GitHub repository | https://github.com/edyeluandrew/rowan.git |
| Backend entry | https://github.com/edyeluandrew/rowan/blob/main/backend/src/server.js |
| stellar.toml route | https://github.com/edyeluandrew/rowan/blob/main/backend/src/routes/wellKnown.js |
| SEP-10 auth routes | https://github.com/edyeluandrew/rowan/blob/main/backend/src/routes/auth.js |
| Horizon watcher | https://github.com/edyeluandrew/rowan/blob/main/backend/src/services/horizonWatcher.js |
| Admin app | https://github.com/edyeluandrew/rowan/tree/main/admin |
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

## Transaction Evidence (Fresh — 20 July 2026, On-Chain + Log Verified)

| Resource | Value / URL |
|----------|-------------|
| Evidence transaction hash | `52ba2f9708431f304af7c5581259d1af7e3680b515382293d666e2700fb366c5` |
| Evidence transaction (Stellar Expert) | https://stellar.expert/explorer/testnet/tx/52ba2f9708431f304af7c5581259d1af7e3680b515382293d666e2700fb366c5 |
| Payment type | Inbound native XLM to escrow (no memo — safe evidence test) |
| Amount | 0.1 XLM |
| Sender (public) | `GAZFTOHMOBLEWXH3FZBU2ZZORVF7WHAHUUJCR7IOH6IYRAOCMG7DY6FJ` |
| Escrow (public) | `GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA` |
| Confirmed (on-chain) | 2026-07-20T16:43:10Z |
| Backend log (Render) | `[Horizon] ⚠️ Payment without Rowan sell memo — ignoring` at ~2026-07-20T16:43:13Z |
| Detection latency | **~3 seconds** (on-chain confirm → backend log) |

Screenshots: `07-test-payment-explorer.png`, `08-horizon-detection-log.png`

---

## Transaction Evidence (Historical — On-Chain Only)

| Resource | Value / URL |
|----------|-------------|
| Evidence transaction hash | `229785de840c60e8ba7d76e585910707c60dc9d9e4098b8d29263e1a1f15e410` |
| Evidence transaction (Stellar Expert) | https://stellar.expert/explorer/testnet/tx/229785de840c60e8ba7d76e585910707c60dc9d9e4098b8d29263e1a1f15e410 |
| Payment type | Inbound native XLM to escrow |
| Amount | 6.2382206 XLM |
| Sender (public) | `GCM674LIRDH6JA7XPB3VPVHLNND7M3GQTRCNOO3LQ64DAPI72SOQTNMZ` |
| Confirmed (on-chain) | 2026-07-04T08:24:48Z |

---

## Evidence Media (Placeholders — To Be Completed)

| Resource | Status |
|----------|--------|
| Evidence screen recording | _[TO BE UPLOADED — link TBD]_ |
| Screenshot folder | _[TO BE UPLOADED — e.g. Google Drive / GitHub release assets]_ |

Suggested recording host: unlisted YouTube or Loom. Do not include secrets in recording.

---

## Original SOW URLs (Not Currently Active)

Documented for transparency — functional equivalents above are live:

| Original SOW URL | Current equivalent |
|------------------|-------------------|
| https://api.rowan.app | https://rowan-1-9crb.onrender.com |
| https://api.rowan.app/.well-known/stellar.toml | https://rowan-1-9crb.onrender.com/.well-known/stellar.toml |
| https://admin.rowan.app | https://rowan-dbb4.vercel.app |

---

## Quick Verification Commands (No Secrets)

```bash
# Backend health
curl -s https://rowan-1-9crb.onrender.com/health

# stellar.toml
curl -s https://rowan-1-9crb.onrender.com/.well-known/stellar.toml

# SEP-10 challenge (replace G-address)
curl -s "https://rowan-1-9crb.onrender.com/api/v1/auth/challenge?account=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```
