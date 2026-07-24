# Rowan Phase 1 Report

**Project Name:** Rowan  
**Team:** Edyelu Andrew, Eragu Enoch, Laloyo Joshua, Kabuye Wamala  
**Website:** https://rowan-nt9a.vercel.app/  
**Backend API:** https://rowan-1-9crb.onrender.com  
**Admin panel:** https://rowan-dbb4.vercel.app/  
**Contact email:** edyeluandrew1@gmail.com  
**Ambassador chapter:** East Africa — Sarah Wahinya  
**GitHub repository:** https://github.com/edyeluandrew/rowan.git  
**Network:** Stellar Testnet only  
**Report date:** 21 July 2026  

---

## Deliverable 1: Backend API, SEP-1 & SEP-10 Authentication

For this deliverable, we deployed a production Node.js backend on Render with PostgreSQL and Redis, startup environment validation, and a public SEP-1 `stellar.toml` file that wallets and clients can discover automatically. The backend exposes a full SEP-10 web authentication flow — a client requests a challenge transaction, signs it with their Stellar keypair, and posts the signed XDR back to receive a JWT session token. We verified this end-to-end on live testnet: health checks confirm all three dependencies (database, Redis, Horizon watcher) are connected, the TOML serves the correct testnet network passphrase, WEB_AUTH endpoint, public signing key, and currency listings (native XLM and USDC), and a signed challenge successfully returns a JWT via both the register and login paths.

One of the biggest challenges here was getting SEP-10 evidence capture right during testing. The updated Stellar Laboratory UI made it easy to accidentally sign a payment transaction or use the "Sign message" tool instead of importing the challenge XDR as a transaction — several early attempts returned 401 errors because the challenge had expired or the wrong payload was signed. We also had to document the difference between `/register` (new users, returns 409 if the account already exists) and `/submit` (returning users). On the infrastructure side, our original SOW referenced Railway and custom domains (`api.rowan.app`); we deployed on Render with the URL `rowan-1-9crb.onrender.com`, which required us to update the WEB_AUTH endpoint in stellar.toml and document the variation clearly for reviewers.

**Evidence**

- Live backend health check: https://rowan-1-9crb.onrender.com/health  
  (`status: ok`, `db: connected`, `redis: connected`, `horizon: connected`)
- SEP-1 stellar.toml (public): https://rowan-1-9crb.onrender.com/.well-known/stellar.toml  
  (testnet passphrase, WEB_AUTH_ENDPOINT, SIGNING_KEY, CURRENCIES — no secrets)
- SEP-10 challenge endpoint: https://rowan-1-9crb.onrender.com/api/v1/auth/challenge?account=GCLFWZD56SRB4HCDN3MPGDFPDUC6DEC3UGVXAV53NQVXDMKXUXFFHIOG
- GitHub — backend entry: https://github.com/edyeluandrew/rowan/blob/main/backend/src/server.js
- GitHub — SEP-10 auth routes: https://github.com/edyeluandrew/rowan/blob/main/backend/src/routes/auth.js
- GitHub — stellar.toml route: https://github.com/edyeluandrew/rowan/blob/main/backend/src/routes/wellKnown.js
- Screenshot — backend health: `docs/instawards/screenshots/deliverable-1-backend-sep1-sep10/01-backend-health.png`
- Screenshot — Render env vars (names visible, all values masked): `02-render-env-names-values-hidden-part1.png` through `part5.png`
- Screenshot — stellar.toml in browser: `03-stellar-toml.png`
- Screenshot — SEP-10 GET challenge response: `04-sep10-get-challenge.png`
- Screenshot — SEP-10 POST JWT (token redacted): `05-sep10-post-jwt-masked.png`
- Demo video (backend + SEP-10 walkthrough): _[TO BE ADDED — YouTube or Google Drive URL]_

---

## Deliverable 2: Escrow Account & Horizon Payment Streaming

For this deliverable, we created and funded a dedicated testnet escrow account (`GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA`), stored the secret key in Render environment variables only (never in source code), and built a Horizon streaming watcher that detects incoming XLM payments in real time. Every inbound payment is logged as a structured event with sender address, amount, and transaction reference. The stream cursor is persisted in Redis so detection resumes correctly after server restarts, and the watcher includes automatic reconnect logic if the stream drops. We ran a fresh evidence test by sending 0.1 XLM to the escrow address with no memo; the payment appeared on Stellar Expert within seconds, and the Render backend log showed `[Horizon] ⭐ Payment event: GBEMAX... → GCIRNEH... (0.1000000 XLM)` at the same timestamp — well inside the 5-second detection target.

The main challenge here was making the detection log visible in production. Our logger defaults to `warn` level in production, but the payment event was initially logged at `info` — so payments were being detected correctly but the log lines were invisible in Render until we promoted the detection event to `warn` level. We also had to be careful during evidence capture to send memo-free test payments rather than payments with `ROWAN-qt_*` memos, because the cashout pipeline (Phase 2 scope) only processes memo-tagged deposits — memo-free payments are logged at the stream level and then intentionally ignored for settlement, which is the correct and safe behaviour for a foundation-phase demo.

**Evidence**

- Escrow account (Stellar Expert): https://stellar.expert/explorer/testnet/account/GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA  
  (funded — ~19,237 XLM + USDC testnet balance visible)
- Evidence transaction hash: `183796303ae529608943bf4405f643eb31e6340e4ef15798a92340bc488930d7`
- Stellar Expert transaction link: https://stellar.expert/explorer/testnet/tx/183796303ae529608943bf4405f643eb31e6340e4ef15798a92340bc488930d7  
  (0.1 XLM from `GBEMAXEUIZZCQHDP2CBOLFBAHY6KP5KAOJHH65PI2L2SRE4PJ6VUV4E2` → escrow, confirmed 2026-07-20 17:05:58 UTC)
- Backend health — Horizon connected: https://rowan-1-9crb.onrender.com/health
- GitHub — Horizon watcher: https://github.com/edyeluandrew/rowan/blob/main/backend/src/services/horizonWatcher.js
- Render log line: `[Horizon] ⭐ Payment event: GBEMAX... → GCIRNEH... (0.1000000 XLM)` — detection latency **<1 second**
- Screenshot — escrow account funded: `docs/instawards/screenshots/deliverable-2-escrow-horizon/06-escrow-stellar-expert.png`
- Screenshot — on-chain payment on explorer: `07-test-payment-explorer.png`
- Screenshot — Horizon detection in Render logs: `08-horizon-detection-log.png`
- Demo video (escrow + Horizon detection): _[TO BE ADDED — YouTube or Google Drive URL]_

---

## Deliverable 3: Admin Web Application

For this deliverable, we deployed a React admin panel on Vercel with secure email/password login (and optional 2FA), a System Health dashboard showing the status of all six platform services (API Server, PostgreSQL, Redis, Stellar Horizon, WebSocket, Escrow Account), a trader management interface where pending registrations can be reviewed and approved or suspended with a confirmation dialog, and a full audit log that records every admin action with timestamp, admin identity, action type, and entity ID. We tested the complete approval flow live: a pending trader (Edyelu Andrew) was visible in the pending list, the approve action triggered a confirmation dialog, the trader status changed to Active after confirmation, and the audit log recorded a `Trader Approved` entry tied to admin email `edyeluandrew1@gmail.com` and trader ID `c922394b-455a-4219-acbe-77ffdc3e07f5`.

The main challenges here were API route mismatches between the admin frontend and backend that blocked the approve button during early testing — the UI was calling `POST .../approve` while the backend expected `POST .../verify`, and a separate bug caused a 500 error when the frontend sent an empty POST body. Both were fixed, redeployed, and re-tested. We also improved the audit log UI to join and display the admin email address rather than only an internal ID, which makes the audit trail much clearer for reviewers. Like Deliverable 1, the original SOW referenced `admin.rowan.app`; the live admin is at `rowan-dbb4.vercel.app`, which we document as an equivalent.

**Evidence**

- Live admin panel: https://rowan-dbb4.vercel.app/
- Admin login: https://rowan-dbb4.vercel.app/login
- GitHub — admin app: https://github.com/edyeluandrew/rowan/tree/main/admin
- GitHub — admin verify route: https://github.com/edyeluandrew/rowan/blob/main/backend/src/routes/admin/traders.js
- Screenshot — System Health (all 6 services healthy): `docs/instawards/screenshots/deliverable-3-admin/10-admin-system-health.png`
- Screenshot — pending trader list: `11-test-partner-pending.png`
- Screenshot — approve confirmation dialog: `12-partner-approval-confirmation.png`
- Screenshot — trader approved (Active status): `13-test-partner-approved.png`
- Screenshot — audit log entry: `14-admin-audit-log.png`
- Demo video (admin approval + audit log): _[TO BE ADDED — YouTube or Google Drive URL]_

---

## Gaps & Next Steps

This phase set out to solve a real, well-defined problem: East Africans holding XLM or USDC on Stellar have no reliable, instant path to convert those assets into mobile money they can actually spend. Over the past 30 days, Rowan has moved from a validated concept to a working Stellar testnet foundation — live backend, SEP-1 discovery, SEP-10 authentication, a funded escrow with real-time payment detection, and an admin operations panel — that directly addresses the infrastructure gap before any cashout logic can run.

All three committed deliverables were completed and are backed by verifiable evidence. The backend is live on Render with PostgreSQL, Redis, and Horizon all connected; SEP-1 and SEP-10 work on testnet with documented screenshots and live URLs; the escrow account is funded and inbound payments are detected in under one second; and the admin panel supports the full trader approval workflow with a persistent audit trail. We also deployed a user-facing web app at https://rowan-nt9a.vercel.app/ as additional context, though it sits outside the Phase 1 SOW scope.

**Known gaps we are transparent about:**

- Custom domains (`api.rowan.app`, `admin.rowan.app`) are not yet configured — functional equivalents on Render and Vercel are live and documented.
- The demo screen recording is not yet uploaded — placeholder above will be replaced with a YouTube or Google Drive link before final Ambassador submission.
- End-to-end cashout automation (quote → memo-tagged deposit → trader match → MoMo payout) is Phase 2 scope — the Horizon stream currently logs all payments but only processes `ROWAN-qt_*` memo deposits for settlement.
- Mainnet deployment is explicitly out of scope for this Instawards phase.

**Proposed Phase 2 focus:**

Rather than treating the remaining work as an open-ended backlog, we are proposing a scoped follow-on focused on the highest-value next step: **end-to-end testnet cashout** — connecting the escrow detection we built in Phase 1 to real trader matching and mobile-money payout, with formal pilot agreements with 1–2 traders in Uganda. Alongside that, we will configure custom domains, add external uptime monitoring, and harden the platform based on Ambassador feedback.

With the Stellar foundation this Instawards phase was meant to deliver now demonstrably in place, we believe Rowan is ready for Ambassador review and positioned for a focused Phase 2 execution sprint.

---

**Submitted by:** Edyelu Andrew on behalf of the Rowan builder team  
**Ambassador review:** Sarah Wahinya, East Africa  
**Supporting documentation:** `docs/instawards/` (completion report, evidence links, checklist, 17 screenshots)

*This report contains public URLs and public Stellar addresses only. No private keys, connection strings, passwords, or full JWT tokens are included.*
