# Rowan — Current State Assessment

**Document:** 01 of 12  
**Version:** 1.0 | **Date:** 24 July 2026  
**Font (print):** Times New Roman, 12pt  

---

## 1. Purpose

This document records **what already exists in the Rowan repository and live deployment** as of 24 July 2026. Every roadmap item in Documents 02–10 is measured against this baseline. Items marked "Done" or "Partial" should **not be rebuilt** — only extended.

---

## 2. Repository Structure

| Path | Role |
|------|------|
| `backend/` | Node.js Express API — core business logic |
| `admin/` | React admin dashboard (Vercel) |
| `user-web/` | User-facing web wallet (Vercel) |
| `rowan-mobile/` | Capacitor mobile app |
| `frontend/` | Additional frontend (legacy/alternate) |
| `docs/instawards/` | Phase 1 evidence & submission |
| `docs/roadmap/` | This roadmap document set |

---

## 3. Feature Completeness Matrix

| Area | Completeness | Status summary |
|------|--------------|----------------|
| Stellar backend (SEP-1, SEP-10, escrow, Horizon) | **100%** | Phase 1 complete, live on Render |
| P2P cashout (sell USDC → MoMo) | **~85%** | Core flow works; fiat leg is manual |
| P2P buy (MoMo → USDC) | **~85%** | Core flow works; fiat leg is manual |
| Express auto-match | **~80%** | Preview + matching engine exists |
| Trader marketplace ads | **~80%** | Ads, accept, float, SLA |
| Trader onboarding & verification | **~85%** | Admin approve flow fixed and evidenced |
| Disputes, chat, reviews | **~75%** | Built; ops maturity varies |
| Internal KYC (user tiers) | **~60%** | Routes + admin review; no Smile ID |
| AML screening | **~40%** | Local sanctions/PEP; no paid provider |
| Fraud monitoring | **~50%** | Velocity caps; needs tier integration |
| Multi-country (UG/KE/TZ) | **~30%** | Constants + FX; not config-driven |
| Rwanda | **~10%** | Mentioned in strategy; not in code |
| Bill payments / airtime | **0%** | Not started |
| Savings / yield | **0%** | Not started |
| Virtual cards | **0%** | Not started |
| Payment aggregators | **0%** | Manual MoMo by design in MVP |
| CCTP / cross-chain | **0%** | Stellar only; future doc references only |
| Corporate compliance (Beta Tech Labs) | **~20%** | URSB registered; no bank account yet |

---

## 4. Backend — Existing Modules

### 4.1 Authentication & identity

| Module | Path | Notes |
|--------|------|-------|
| SEP-10 auth | `backend/src/routes/auth.js` | challenge, register, submit, admin login |
| JWT middleware | `backend/src/middleware/auth.js` | Token signing and verification |
| User KYC routes | `backend/src/routes/user.js` | GET/POST kyc, documents |
| Admin KYC review | `backend/src/routes/admin.js` | Approve/reject submissions |
| Sanctions screening | `backend/src/services/sanctionsService.js` | Local list screening |
| Fraud monitor | `backend/src/services/fraudMonitor.js` | Velocity, daily caps |

### 4.2 P2P & escrow

| Module | Path | Notes |
|--------|------|-------|
| Cashout (sell) | `backend/src/routes/cashout.js` | User sells crypto for MoMo |
| Buy | `backend/src/routes/buy.js` | User buys crypto with MoMo |
| Express | `backend/src/routes/express.js` | Auto-match preview |
| Traders public | `backend/src/routes/traders.js` | Marketplace ads |
| Trader ops | `backend/src/routes/trader.js` | Accept, payout, earnings |
| Trader onboarding | `backend/src/routes/traderOnboarding.js` | Registration pipeline |
| Payout settings | `backend/src/routes/payoutSettings.js` | MoMo numbers, country |
| Escrow controller | `backend/src/services/escrowController.js` | Stellar escrow logic |
| Matching engines | `matchingEngine.js`, `buyMatchingEngine.js` | Trader matching |
| Horizon watcher | `backend/src/services/horizonWatcher.js` | Payment stream |
| Trader verification | `backend/src/services/traderVerificationService.js` | ID, MoMo OTP, history |

### 4.3 Admin & ops

| Module | Path | Notes |
|--------|------|-------|
| Audit log | `backend/src/services/auditLogService.js` | Admin action persistence |
| System health API | Admin routes + public `/health` | DB, Redis, Horizon status |
| Admin frontend | `admin/src/features/*` | Traders, KYC, audit, health |

### 4.4 Configuration

| Module | Path | Notes |
|--------|------|-------|
| App config | `backend/src/config/index.js` | KYC tiers, limits, JWT |
| Stellar config | `backend/src/config/stellar.js` | Horizon URL, passphrase |
| FX providers | `backend/src/services/fx/fxProviders.js` | UGX/KES/TZS normalization |
| Country constants | `rowan-mobile/src/wallet/utils/constants.js` | Networks per country |

---

## 5. Frontend — Existing Surfaces

| App | URL | Features |
|-----|-----|----------|
| User web | https://rowan-nt9a.vercel.app/ | Wallet, cashout, buy flows |
| Admin | https://rowan-dbb4.vercel.app/ | Traders, KYC, health, audit |
| Mobile | Capacitor build | VerifyIdentity, wallet pages |

---

## 6. Explicit Gaps (Do Not Assume Built)

The following are **not in the codebase** and appear only in strategy discussions or competitor research:

1. Reloadly / Flutterwave / Yellow Pay API integrations  
2. Smile ID / MetaMap SDK  
3. Virtual card provider (Maplerad, Bridge)  
4. Stellar AMM / yield product  
5. CCTP / Wormhole / LayerZero  
6. Nigeria, Ghana, South Africa corridors  
7. Automated MoMo disbursement webhooks  
8. STR reporting workflow to Financial Intelligence Authority  
9. Corporate bank settlement pipeline  
10. B2B merchant bulk payout API  

---

## 7. Technical Debt Relevant to Roadmap

| Item | Impact | Address in |
|------|--------|------------|
| Hardcoded country list (UG/KE/TZ) | Blocks RW + aggregator per-country config | E1 |
| Manual MoMo payout (trader sends, user confirms) | Does not scale pan-Africa | C1–C6 |
| KYC without third-party ID verification | Aggregator rejection risk | A5 |
| No utility spend from USDC balance | No retention hook | B2–B7 |
| Production LOG_LEVEL hides info logs | Ops visibility (fixed for Horizon) | G3 |
| Custom domains not configured | Professional URLs for launch | G1 |

---

## 8. Live Infrastructure

| Service | Provider | URL |
|---------|----------|-----|
| Backend API | Render | https://rowan-1-9crb.onrender.com |
| User app | Vercel | https://rowan-nt9a.vercel.app/ |
| Admin | Vercel | https://rowan-dbb4.vercel.app/ |
| Database | Render PostgreSQL | (env `DATABASE_URL`) |
| Cache | Render Redis | (env `REDIS_URL`) |
| Blockchain | Stellar testnet | Horizon testnet |
| Escrow (public) | `GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA` |

---

## 9. Beta Tech Labs — Corporate Readiness

| Requirement | Status |
|-------------|--------|
| URSB incorporation | **Done** |
| Corporate TIN (URA) | **Verify / complete if missing** |
| Corporate bank account | **Not opened** |
| AML/CFT written policy | **Not drafted** |
| Smile ID developer account | **Not opened** |
| Yellow Pay sandbox | **Not opened** |
| Reloadly sandbox | **Not opened** |

---

## 10. Baseline Conclusion

Rowan has a **strong Stellar P2P core** suitable for Phase 2 extension. The roadmap does **not** require rewriting Phase 1. New work falls into three buckets:

1. **Compliance shell** (Beta Tech Labs + Smile ID + AML) — unlocks aggregators  
2. **Utility layer** (airtime, bills, savings) — unlocks retention  
3. **Aggregator layer** (Yellow Pay, etc.) — unlocks pan-African scale  

---

*Next: `02_MASTER_BUILD_LIST.md`*
