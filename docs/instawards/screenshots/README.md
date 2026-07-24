# Rowan Phase 1 — Evidence Screenshots Index

**Prepared:** 21 July 2026  
**For:** Instawards Ambassador review (Sarah Wahinya, East Africa)

Screenshots are grouped by deliverable. Each file name matches the evidence checklist.

---

## Deliverable 1 — Backend + SEP-1 + SEP-10

**Folder:** `deliverable-1-backend-sep1-sep10/`  
**Proves:** Live backend, secure deployment, SEP-1 discovery, SEP-10 authentication.

| File | What it shows | What to verify |
|------|---------------|----------------|
| `01-backend-health.png` | `GET /health` JSON response | `status: ok`, `db`, `redis`, `horizon` all connected |
| `02-render-env-names-values-hidden-part1.png` | Render env vars (page 1) | Key names visible; **all values masked** |
| `02-render-env-names-values-hidden-part2.png` | Render env vars (page 2) | Same — no secrets exposed |
| `02-render-env-names-values-hidden-part3.png` | Render env vars (page 3) | Same |
| `02-render-env-names-values-hidden-part4.png` | Render env vars (page 4) | Same |
| `02-render-env-names-values-hidden-part5.png` | Render env vars (page 5) | Same |
| `03-stellar-toml.png` | `/.well-known/stellar.toml` in browser | `NETWORK_PASSPHRASE`, `WEB_AUTH_ENDPOINT`, `SIGNING_KEY`, `CURRENCIES`, `ACCOUNTS` |
| `04-sep10-get-challenge.png` | `GET /api/v1/auth/challenge?account=G...` | Response includes `transaction` (XDR) and `networkPassphrase` |
| `05-sep10-post-jwt-masked.png` | `POST /api/v1/auth/submit` in PowerShell | JWT returned; token partially redacted |

**Live URLs for cross-check:**
- https://rowan-1-9crb.onrender.com/health
- https://rowan-1-9crb.onrender.com/.well-known/stellar.toml
- https://rowan-1-9crb.onrender.com/api/v1/auth/challenge?account=GCLFWZD56SRB4HCDN3MPGDFPDUC6DEC3UGVXAV53NQVXDMKXUXFFHIOG

---

## Deliverable 2 — Escrow + Horizon Streaming

**Folder:** `deliverable-2-escrow-horizon/`  
**Proves:** Funded testnet escrow, on-chain payment, real-time Horizon detection.

| File | What it shows | What to verify |
|------|---------------|----------------|
| `06-escrow-stellar-expert.png` | Escrow account on Stellar Expert | Address `GCIRNEH3...NBUEA`, XLM/USDC balances, activity |
| `07-test-payment-explorer.png` | Evidence transaction on explorer | Tx `183796303...`, 0.1 XLM, sender → escrow, successful |
| `08-horizon-detection-log.png` | Render backend logs | `[Horizon] ⭐ Payment event: GBEMAX... → GCIRNEH... (0.1000000 XLM)` |

**On-chain reference:**
- Escrow: `GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA`
- Evidence tx: `183796303ae529608943bf4405f643eb31e6340e4ef15798a92340bc488930d7`
- Explorer: https://stellar.expert/explorer/testnet/tx/183796303ae529608943bf4405f643eb31e6340e4ef15798a92340bc488930d7

---

## Deliverable 3 — Admin Application

**Folder:** `deliverable-3-admin/`  
**Proves:** Admin deployed, system health, trader approval flow, audit trail.

| File | What it shows | What to verify |
|------|---------------|----------------|
| `10-admin-system-health.png` | Admin → Health page | All 6 services healthy (API, PostgreSQL, Redis, Horizon, WebSocket, Escrow) |
| `11-test-partner-pending.png` | Admin → Traders → Pending | Edyelu Andrew listed with **Pending** status |
| `12-partner-approval-confirmation.png` | Trader detail + confirm dialog | "Approve Trader" confirmation before action |
| `13-test-partner-approved.png` | Trader detail after approval | Edyelu Andrew status **Active** |
| `14-admin-audit-log.png` | Admin → Audit Logs | `Trader Approved` entry, admin email, trader ID `c922394b...` |

**Live URL:** https://rowan-dbb4.vercel.app/login

---

## Summary

| Deliverable | Screenshots | Folder |
|-------------|-------------|--------|
| D1 — Backend + SEP-1 + SEP-10 | 9 files (01–05, env parts 1–5) | `deliverable-1-backend-sep1-sep10/` |
| D2 — Escrow + Horizon | 3 files (06–08) | `deliverable-2-escrow-horizon/` |
| D3 — Admin app | 5 files (10–14) | `deliverable-3-admin/` |

**Total:** 17 screenshots
