# Rowan Phase 1 — Screen Recording Script

**Target length:** 3 minutes 40 seconds  
**Audience:** Instawards Ambassador Chapter Lead (non-technical friendly)  
**Rules:** No secrets on screen. Mask JWTs. Hide env var values. Use incognito browser where possible.

---

## 00:00–00:15 — Introduction

**On screen:** Title slide or browser home tab.

**Narration:**

> "This is Rowan Phase 1 evidence for the Instawards Stellar foundation deliverable. I'm showing the live testnet backend, SEP-1 discovery, SEP-10 authentication, escrow payment detection, and the admin panel — all verifiable from public URLs without installing anything."

---

## 00:15–00:45 — Public stellar.toml (Deliverable 1)

**On screen:** Open https://rowan-1-9crb.onrender.com/.well-known/stellar.toml in a fresh browser tab.

**Show:**

- Page loads without login
- `NETWORK_PASSPHRASE` = Test SDF Network
- `WEB_AUTH_ENDPOINT` pointing to the live API
- `SIGNING_KEY` as a G-address (public key)
- `[[CURRENCIES]]` section with native XLM

**Narration:**

> "Rowan publishes a SEP-1 compliant stellar.toml file. Any Stellar wallet can discover our network, web authentication endpoint, signing key, and supported currencies. The file is public with CORS enabled for cross-origin wallet access."

**Hide:** Nothing required if TOML is clean (verify no S-keys before recording).

---

## 00:45–01:20 — SEP-10 Challenge and JWT (Deliverable 1)

**On screen:** Stellar Laboratory (testnet) or Postman/curl split view.

**Steps to show:**

1. `GET https://rowan-1-9crb.onrender.com/api/v1/auth/challenge?account=<testnet G-address>`
2. Highlight JSON response: `transaction` (XDR) and `networkPassphrase`
3. Sign challenge with a **throwaway** testnet keypair in Laboratory
4. `POST https://rowan-1-9crb.onrender.com/api/v1/auth/register` with signed XDR
5. Show response contains `"token"` — **blur or truncate** after `eyJhbGci...`

**Narration:**

> "SEP-10 web authentication is live. The server returns a signed challenge transaction. After the user signs it and submits the XDR, the backend validates the challenge using the Stellar SDK and returns a JWT. This is the authentication foundation required for Phase 2 SEP-24 and SEP-38 flows."

**Hide:** Private key (S...), full JWT, phoneHash if using real data.

---

## 01:20–01:50 — Stellar Testnet Escrow Account (Deliverable 2)

**On screen:** https://stellar.expert/explorer/testnet/account/GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA

**Show:**

- Account exists
- Native XLM balance
- Recent payment history tab

**Narration:**

> "This is Rowan's dedicated testnet escrow account. It holds user assets during cashout. The secret key is stored only in the deployment environment — never in source code or this recording."

**Hide:** Any secret key material.

---

## 01:50–02:20 — Horizon Detection Log (Deliverable 2)

**On screen:** Render dashboard → rowan-backend → Logs tab.

**Show (one of):**

- **Option A (preferred):** Fresh small XLM payment (no ROWAN memo) sent during recording; log line appears:
  `[Horizon] ⭐ Payment event: G... → GCIRNEH3... (X.XX XLM)`
- **Option B:** Historical log line correlated with explorer tx from 2026-07-04

**Narration:**

> "When XLM arrives at the escrow address, the backend Horizon stream detects it in real time and logs a structured event with the sender, amount, and transaction reference. The stream cursor is persisted in Redis so detection resumes correctly after restarts."

**Hide:** Log lines containing DATABASE_URL, JWT_SECRET, ESCROW_SECRET_KEY, or full connection strings.

---

## 02:20–02:50 — Admin Login and System Health (Deliverable 3)

**On screen:**

1. https://rowan-dbb4.vercel.app/login — log in with admin credentials
2. Navigate to System Health page
3. Briefly open https://rowan-1-9crb.onrender.com/health in second tab for cross-check

**Show:**

- Login succeeds
- Service status tiles (API, PostgreSQL, Redis, Horizon)
- Public health endpoint matches connected status

**Narration:**

> "The Rowan admin panel is deployed on Vercel. After secure login, the System Health page shows whether the API, database, Redis, and Horizon connection are operational — giving reviewers a quick visual confirmation that all platform components are live."

**Hide:** Admin password during typing (use password manager paste or blur field). Hide JWT in browser devtools.

---

## 02:50–03:20 — Test Partner Approval and Audit Log (Deliverable 3)

**On screen:**

1. Traders → Pending → **Instawards Phase 1 Test Partner**
2. Click Approve → confirmation dialog appears → confirm
   - _If UI approve is broken: show API call to `/verify` in Postman with masked admin token, then refresh UI_
3. Audit Logs page → show new entry with timestamp and admin action

**Narration:**

> "Admins can review pending trader registrations, approve or suspend with a confirmation step, and every action is recorded in the audit log with a timestamp and admin identifier."

**Hide:** Real trader phone numbers; use test partner only.

---

## 03:20–03:40 — GitHub and Conclusion

**On screen:** https://github.com/edyeluandrew/rowan — highlight `backend/`, `admin/`, `docs/instawards/`

**Narration:**

> "All Phase 1 source code and documentation are in the public GitHub repository under docs/instawards. Phase 1 delivers the Stellar foundation — live backend, SEP-1, SEP-10, escrow with Horizon streaming, and admin operations — ready for Phase 2 cashout automation. Thank you."

---

## Pre-Recording Checklist

- [ ] Confirm admin approve route works (or prepare Postman fallback)
- [ ] Prepare throwaway testnet keypair for SEP-10 demo
- [ ] Optional: pre-send memo-free XLM test payment for log evidence
- [ ] Close tabs with secrets (Render env values, .env files)
- [ ] Test all URLs in incognito mode
- [ ] Set screen resolution ≥ 1280×720 for readability
