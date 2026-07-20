# Rowan Phase 1 — Evidence Checklist

**For:** Instawards Ambassador review (Sarah Wahinya, East Africa)  
**Date:** 20 July 2026  

Use this checklist before submitting the Phase 1 completion package. Check items only when direct evidence exists.

---

## Deliverable 1 — Backend + SEP-1 + SEP-10

- [x] Backend live at public URL
- [x] PostgreSQL connected (verified via `/health`)
- [x] Redis connected (verified via `/health`)
- [x] Startup validation exists in repository (`backend/src/server.js`)
- [x] `stellar.toml` publicly accessible
- [x] Network passphrase correct for testnet
- [x] WEB_AUTH_ENDPOINT present and points to live challenge URL
- [x] SIGNING_KEY public only (no `S` secrets in TOML)
- [x] Currency listing present (`native` / XLM + USDC)
- [x] SEP-10 challenge works (live test 20 Jul 2026)
- [x] Signed challenge returns JWT (via `/api/v1/auth/register`)
- [x] GitHub source available
- [ ] Screenshot: backend health (`01-backend-health.png`)
- [ ] Screenshot: Render env names, values hidden (`02-render-env-names-values-hidden.png`)
- [ ] Screenshot: stellar.toml in browser (`03-stellar-toml.png`)
- [ ] Screenshot: SEP-10 GET challenge (`04-sep10-get-challenge.png`)
- [ ] Screenshot: SEP-10 POST JWT masked (`05-sep10-post-jwt-masked.png`)

---

## Deliverable 2 — Escrow + Horizon Streaming

- [x] Escrow account exists on testnet
- [x] Escrow account funded (Horizon verified)
- [x] Explorer link works
- [x] Historical inbound XLM payment visible on-chain
- [x] Payment hash saved in documentation
- [ ] Horizon detection log captured (Render logs)
- [ ] Amount / sender / timestamp visible in backend log
- [ ] Detection timing recorded (confirmation → log, target ≤5s)
- [x] Redis cursor persistence implemented in code
- [ ] Redis cursor runtime evidence (optional)
- [x] No secrets visible in code paths reviewed
- [ ] Screenshot: escrow on Stellar Expert (`06-escrow-stellar-expert.png`)
- [ ] Screenshot: test payment explorer (`07-test-payment-explorer.png`)
- [ ] Screenshot: Horizon detection log (`08-horizon-detection-log.png`)

### Safe fresh payment test procedure

1. Send a **small** testnet XLM payment to escrow **without** a ROWAN memo (Stellar Laboratory → Payment)
2. Open Render logs for `rowan-backend`
3. Find line: `[Horizon] ⭐ Payment event: {sender} → {escrow} ({amount} XLM)`
4. Record timestamps; do **not** include private keys in screenshots
5. Do **not** use `ROWAN-qt_*` memos unless intentionally testing cashout pipeline

---

## Deliverable 3 — Admin Application

- [x] Admin URL live (login page loads)
- [ ] Admin login works (requires authorized credentials — not tested in audit)
- [x] System Health page exists in codebase
- [x] Public API health endpoint verified (`/health`)
- [ ] PostgreSQL health visible in admin UI (cross-check with `/health`)
- [ ] Redis health visible in admin UI
- [ ] Horizon health visible in admin UI
- [ ] Test partner visible: **Instawards Phase 1 Test Partner**
- [ ] Approval confirmation dialog shown
- [ ] Partner approved successfully
- [ ] Audit log entry created

**Known blocker (resolved in repo 20 Jul 2026):** Admin UI previously called `POST /traders/:id/approve` but backend exposes `POST /traders/:id/verify`. Fixed in `admin/src/shared/services/api/traders.js` — **deploy admin to Vercel** before evidence capture.

- [ ] Screenshot: admin login (`09-admin-login.png`)
- [ ] Screenshot: System Health (`10-admin-system-health.png`)
- [ ] Screenshot: test partner pending (`11-test-partner-pending.png`)
- [ ] Screenshot: approval confirmation (`12-partner-approval-confirmation.png`)
- [ ] Screenshot: partner approved (`13-test-partner-approved.png`)
- [ ] Screenshot: audit log (`14-admin-audit-log.png`)

---

## Final Package

- [x] Completion report ready (`PHASE_1_COMPLETION_REPORT.md`)
- [x] Public evidence links doc ready (`PHASE_1_PUBLIC_EVIDENCE_LINKS.md`)
- [x] Screen recording script ready (`PHASE_1_SCREEN_RECORDING_SCRIPT.md`)
- [ ] Screenshots captured (0 / 14)
- [ ] Screen recording uploaded
- [ ] Links tested in incognito / private browser
- [x] No secrets in documentation files (scan performed 20 Jul 2026)
- [ ] Ambassador can verify without local setup (pending screenshots + recording)

---

## Screenshot Plan

| Filename | What must be visible | What must be hidden | Proves |
|----------|---------------------|---------------------|--------|
| `01-backend-health.png` | JSON: status ok, db/redis/horizon connected | N/A | D1 backend live |
| `02-render-env-names-values-hidden.png` | Render env var **names** (JWT_SECRET, DATABASE_URL, etc.) | All values masked | D1 secure deployment |
| `03-stellar-toml.png` | Full TOML in browser; NETWORK_PASSPHRASE, WEB_AUTH_ENDPOINT, SIGNING_KEY, CURRENCIES | N/A | D1 SEP-1 |
| `04-sep10-get-challenge.png` | GET challenge response with `transaction` XDR field | N/A | D1 SEP-10 challenge |
| `05-sep10-post-jwt-masked.png` | POST response showing `"token": "eyJ...`**[REDACTED]**"` | Full JWT, any S-keys | D1 SEP-10 JWT |
| `06-escrow-stellar-expert.png` | Escrow G-address, XLM/USDC balances | N/A | D2 escrow funded |
| `07-test-payment-explorer.png` | Tx hash, amount, sender, timestamp on explorer | N/A | D2 on-chain payment |
| `08-horizon-detection-log.png` | Render log: `⭐ Payment event` with from, amount | Secrets, DATABASE_URL in log context | D2 Horizon detection |
| `09-admin-login.png` | Rowan Admin login form | Password field value | D3 admin deployed |
| `10-admin-system-health.png` | System Health tiles; overall status banner | Admin JWT in devtools | D3 health dashboard |
| `11-test-partner-pending.png` | "Instawards Phase 1 Test Partner" in pending list | Real partner PII | D3 pending registrations |
| `12-partner-approval-confirmation.png` | ConfirmDialog: "Approve Trader" | N/A | D3 confirmation required |
| `13-test-partner-approved.png` | Partner status VERIFIED/ACTIVE | Phone numbers unmasked | D3 approval works |
| `14-admin-audit-log.png` | Audit entry: trader_verify_approve, admin ID, timestamp | Full admin email if sensitive | D3 audit trail |

**Do not fabricate screenshots.** Capture from live environment only.
