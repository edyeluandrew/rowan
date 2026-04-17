# ROWAN CASHOUT FLOW: DEEP HARDCODED-VALUES AUDIT

**Date:** April 17, 2026  
**Scope:** Frontend mobile wallet, backend quote engine, rates, escrow, status tracking  
**Status:** Read-only inspection complete

---

## 1. CASHOUT FILES INSPECTED

### Frontend (Mobile Wallet App)
- `wallet/src/pages/Cashout.jsx` — Quote request screen
- `wallet/src/pages/CashoutConfirm.jsx` — Quote confirmation + 60s countdown
- `wallet/src/pages/CashoutSend.jsx` — TX signing/broadcast screen
- `wallet/src/components/cashout/AmountInput.jsx` — Amount validation UI
- `wallet/src/components/cashout/PhoneInput.jsx` — Phone number input w/ masking
- `wallet/src/components/cashout/NetworkSelector.jsx` — Mobile network picker
- `wallet/src/components/cashout/QuoteSummary.jsx` — Quote display
- `wallet/src/utils/constants.js` — Constants definitions

### Backend Quote Engine
- `backend/src/services/quoteEngine.js` — Core quote generation
- `backend/src/routes/cashout.js` — Quote/confirm/refund endpoints
- `backend/src/routes/rates.js` — Indicative rate endpoints
- `backend/src/config/index.js` — Master config
- `backend/src/config/stellar.js` — Stellar network config
- `backend/src/utils/financial.js` — FX conversion utilities

### Backend Escrow & Fraud
- `backend/src/services/escrowController.js` — Deposit handling, TX submission
- `backend/src/services/fraudMonitor.js` — Fraud checks, KYC limits
- `backend/src/services/matchingEngine.js` — Trader matching logic
- `backend/src/middleware/auth.js` — Auth middleware

### Frontend (Web)
- `frontend/src/pages/StellarWallet.jsx` — Wallet display
- `frontend/src/utils/constants.js` — Frontend constants

---

## 2. HARDCODED VALUES FOUND

### A. QUOTE & RATE TTLs

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| **60 seconds** | `config.platform.quoteTtlSeconds` (default 180 if not set) | Quote expiration window | ⚠️ RISKY | Shown in countdown, but default is 180 (mismatch!) |
| **30 seconds** | `config.platform.rateCacheTtlSeconds` | How long legacy rates cached in Redis | ✅ CONFIGURED | Controllable via env |
| **120 seconds** | `escrowController.js` line 32 | Redis lock TTL for deposit processing | ❌ HARDCODED | No config source, prevents double-process |
| **60 seconds** | `escrowController.js` line 381 | Redis lock TTL for release processing | ❌ HARDCODED | No config source |
| **30 seconds** | `matchingEngine.js` line 48 | Redis lock for trader matching | ❌ HARDCODED | No config source |

**⚠️ MISMATCH:** Config says `quoteTtlSeconds` defaults to **180** (3 min), but code comments say 60s. Frontend doesn't read backend config—uses own constant.

---

### B. SLIPPAGE & SPREAD VALUES

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| **0.3%** | `quoteEngine.js` line 11 | Quote slippage tolerance | ❌ HARDCODED | NEW - Good: explicit and small. But why not in config? |
| **0.5%** | `escrowController.js` line 313 | Execution slippage tolerance | ❌ HARDCODED | DOUBLE SLIPPAGE! Quote uses 0.3%, execution uses 0.5% → user might overpay |
| `spreadPercent` | `config.platform.spreadPercent` (default 1.25%) | Platform spread applied to user rate | ✅ CONFIGURED | Controllable via env |
| `feePercent` | `config.platform.feePercent` (default 1%) | Platform fee on fiat amount | ✅ CONFIGURED | Controllable via env |

**⚠️ CRITICAL:** Two different slippage values:
- Quote promises 0.3% protection → calculated with `xlmWithSlippage = xlmNeeded * 1.003`
- Execution applies 0.5% separately → `sendMax = xlmSendMax * 1.005`
- **User could be overcharged slippage twice**

---

### C. AMOUNT LIMITS & VALIDATION

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| **0.01 XLM** | `escrowController.js` line 75 | Amount mismatch tolerance | ❌ HARDCODED | Allows 0.01 XLM variance between quote and deposit |
| **2 XLM** | `config.platform.minXlmAmount` (default) | Minimum XLM for cashout | ✅ CONFIGURED | BUT... |
| **1 XLM** | `wallet/src/utils/constants.MIN_XLM_AMOUNT` | Frontend min display | ❌ MISMATCH | Frontend shows 1 XLM as min, backend enforces 2 XLM |
| **7 digits** | `wallet/src/pages/Cashout.jsx` line 45 | Min phone digits required | ❌ HARDCODED | Validation in UI: `phone.length >= 7` |
| **$200k - $5M UGX** | `fraudMonitor.js` lines 11-14 | KYC-tiered per-tx limits | ❌ HARDCODED | No config source, requires code change to adjust |
| **$90k UGX** | `fraudMonitor.js` line 31 | Per-tx limit flag threshold (80% of limit) | ❌ HARDCODED | Triggers fraud alert if >80% of limit |
| **3 open quotes** | `fraudMonitor.js` line 67 | Max concurrent quotes allowed | ❌ HARDCODED | Hard reject if user has 3+ open quotes |

**🚨 MAJOR MISMATCH:** Frontend says min XLM = 1, backend enforces >= 2. User gets error AFTER requesting quote.

---

### D. FX RATES (Static/Indicative)

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| **3750 UGX/USDC** | `config.usdcFiatRates.UGX` (default) | USDC → UGX conversion | ✅ CONFIGURED | Controllable via env `USDC_RATE_*` |
| **153 KES/USDC** | `config.usdcFiatRates.KES` (default) | USDC → KES conversion | ✅ CONFIGURED | Same as above |
| **2650 TZS/USDC** | `config.usdcFiatRates.TZS` (default) | USDC → TZS conversion | ✅ CONFIGURED | Same as above |

**⚠️ INDICATIVE:** These are **static defaults**. Used for:
1. Fraud checks (estimate user's fiat amount for limit comparison)
2. Admin rate display endpoints (`/api/v1/rates/current`)
3. NOT for binding quotes (which use Horizon paths)

**Risk:** If real XLM/USDC path moves significantly, these static rates become inaccurate for fraud estimates. E.g., if real rate is 2800 but we estimate 3750, fraud check underestimates transaction size.

---

### E. NETWORK & BLOCKCHAIN CONFIG

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| `horizonUrl` | `config.stellar.horizonUrl` (default testnet) | Stellar Horizon endpoint | ✅ CONFIGURED | Via env `HORIZON_URL` |
| `network` | `config.stellar.network` (default 'testnet') | Testnet or mainnet | ✅ CONFIGURED | Via env `STELLAR_NETWORK` |
| **USDC issuer** | `config.usdcIssuerTestnet` / `config.usdcIssuerMainnet` | Which USDC to trade | ✅ CONFIGURED | Testnet hardcoded, mainnet env var |
| `escrowPublicKey` | `config.stellar.escrowPublicKey` | Escrow address | ✅ CONFIGURED | Via env, critical |
| **'USDC' asset code** | `quoteEngine.js` + `config/stellar.js` | Hard-coded in path discovery | ❌ HARDCODED | Only USDC supported, no config knob |

**🚨 RISK:** Only USDC is supported in path discovery logic. If we ever want to quote EURC or other stablecoins, requires code change.

---

### F. TIMEOUTS & RETRY WINDOWS

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| **180 seconds** | `config.platform.traderAcceptTimeoutSeconds` (default) | How long trader has to accept match | ✅ CONFIGURED | Via env |
| **300 seconds** | `config.platform.traderConfirmTimeoutSeconds` (default) | How long trader sits before confirming fiat sent | ✅ CONFIGURED | Via env |
| **60 minutes** | `config.platform.orphanFiatSentMinutes` (default) | Auto-refund if trader says "sent" but user never confirms | ✅ CONFIGURED | Via env |
| **30 minutes** | `config.platform.orphanMatchedMinutes` (default) | Auto-dismiss match if trader never accepts | ✅ CONFIGURED | Via env |
| **180 seconds** | `wallet/src/utils/constants.STELLAR_TX_TIMEOUT_SECONDS` | Frontend: how long to wait for TX broadcast | ❌ HARDCODED | 3 minutes, no config |
| **2000 ms** | `escrowController.js` line 167 | Delay before cleanup after match | ❌ HARDCODED | Hardcoded cleanup delay |
| **5000 ms** | `escrowController.js` line 493 | Delay before lock release cleanup | ❌ HARDCODED | Hardcoded cleanup delay |

**⚠️ CONCERN:** Frontend timeout (180s) hardcoded. If backend timeouts change (via config), frontend won't know—could lead to UX confusion.

---

### G. STATE LABELS & ENUMS

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| `PENDING_ESCROW`, `ESCROW_FUNDED`, `TRADER_MATCHED`, etc. | `wallet/src/utils/constants.TX_STATES` | Transaction state labels | ❌ HARDCODED | Frontend labels must match DB state values |
| `QUOTE_REQUESTED`, `QUOTE_CONFIRMED` | Same | More state labels | ❌ HARDCODED | Same risk |
| `'PENDING'`, `'CONFIRMED'`, `'COMPLETED'` | `quoteEngine.js` + DB | Quote status values | ❌ HARDCODED | No enum or shared constants |

**🚨 SYNC RISK:** If backend adds new state `'TRADER_TIMEOUT'` but frontend doesn't know about it, UI breaks or shows unknown state.

---

### H. PHONE & NETWORK VALIDATION

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| **7 digit minimum** | `wallet/src/pages/Cashout.jsx` line 45 | Phone number validation | ❌ HARDCODED | Plus code in `canProceed` checks |
| **Country codes** | `wallet/src/utils/constants.COUNTRY_CODES` | Country prefix mappings | ❌ HARDCODED | UG=+256, KE=+254, TZ=+255 |
| **Default +256** | `wallet/src/pages/Cashout.jsx` line 48 | Fallback country code | ❌ HARDCODED | Returns '+256' if networkConfig not found |
| **Supported networks** | `wallet/src/utils/constants.NETWORKS` | Valid mobile money providers | ❌ HARDCODED | Enum of MTN_MOMO_UG, AIRTEL_UG, MPESA_KE, etc. |

**⚠️ CONCERN:** If we add a new operator (e.g., AIRTEL_TZ), frontend constants must be updated. No single config source.

---

### I. UI TIMEOUT / ANIMATION DELAYS

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| **2000 ms** | `frontend/src/utils/constants.COPY_FEEDBACK_TIMEOUT_MS` | How long "copied" toast shows | ❌ HARDCODED | Small BOM, low risk |
| **1500 ms** | `wallet/src/utils/constants.WALLET_GEN_DELAY_MS` | Delay after wallet generation | ❌ HARDCODED | UX only, low risk |
| **30000 ms** | `wallet/src/utils/constants.CLIPBOARD_AUTO_CLEAR_MS` | Clear clipboard after 30s | ❌ HARDCODED | Security feature, low risk |
| **30000 ms** (30s) | `frontend/src/utils/constants.API_TIMEOUT` | Axios timeout | ✅ HARDCODED | Same value in wallet, consistent |
| **30000 ms** (30s) | `wallet/src/utils/constants.API_TIMEOUT` | Same as above | ✅ HARDCODED | Duplicated in both apps |

**Low risk:** UI timeouts are not business-critical.

---

### J. ASSET ASSUMPTIONS

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| **XLM native asset** | `quoteEngine.js` line 9 | Always quote XLM → USDC | ❌ HARDCODED | No code path for other source assets |
| **USDC destination** | `quoteEngine.js` lines throughout | Always convert to USDC | ❌ HARDCODED | Path discovery only supports USDC |
| **Escrow self-swap** | `escrowController.js` line 34 | DestAddr = sourceAddr (self) | ❌ HARDCODED | Assumes escrow swaps to itself |
| **1,000,000 stroops/USDC** | `financial.js` line 49 | Stroops → USDC conversion | ✅ STANDARD | Stellar standard, not risky |

**🚨 RISK:** If we want to support XLM → EURC or XLM → NATIVE_USD, requires major code refactor. Path discovery tightly coupled to USDC.

---

### K. MERCHANT/TRADER LOGIC

| Value | Location | Controls | Status | Risk |
|-------|----------|----------|--------|------|
| **100 trades required** | `config.traderVerification.minP2pTrades` (default) | Minimum trader history | ✅ CONFIGURED | Via env |
| **95% completion rate** | `config.traderVerification.minCompletionRate` (default) | Trader quality threshold | ✅ CONFIGURED | Via env |
| **5 failed TXs in 24h** | `fraudMonitor.js` line 110 | Auto-pause threshold | ❌ HARDCODED | Trader auto-suspended after 5 failures |
| **3+ open disputes** | `fraudMonitor.js` line 119 | Auto-suspend threshold | ❌ HARDCODED | Trader auto-suspended after 3 disputes |

**⚠️ RISK:** Thresholds (5, 3) are hardcoded. If we need to adjust due to volume, requires code redeploy.

---

## 3. DUPLICATED CONSTANTS / MAGIC NUMBERS

### Frontend Constants Scattered

| Constant | Frontend Location | Backend Location | Sync Risk |
|----------|---|---|---|
| MIN_XLM_AMOUNT | wallet: 1 | backend config: 2 | 🚨 MISMATCHED |
| QUOTE_TTL | wallet: not visible | backend config: 180s | ⚠️ HIDDEN MISMATCH |
| State labels | wallet/constants.TX_STATES | DB enum (inferred) | 🚨 SYNC NEEDED |
| Network codes | wallet/constants.NETWORKS | backend networkToFiat() | ✅ OK |
| Country codes | wallet/constants.COUNTRY_CODES | hardcoded in route input | ⚠️ REVIEW |
| Slippage % | backend: 0.3% | backend execution: 0.5% | 🚨 DOUBLE |
| API timeout | frontend: 30s | backend: (no explicit) | ⚠️ INCONSISTENT |

**⚠️ BIGGEST SYNC ISSUE:** MIN_XLM_AMOUNT in frontend (1) vs backend (2)  
→ User clicks "get quote" with 1.5 XLM → request succeeds → backend rejects → confusing error

---

### Repeated Lock TTLs

| Service | Lock TTL | File | Status |
|---------|----------|------|--------|
| Deposit processing | 120s | escrowController.js | ❌ Hardcoded |
| Release processing | 60s | escrowController.js | ❌ Hardcoded |
| Trader matching | 30s | matchingEngine.js | ❌ Hardcoded |
| Dispute response | 30s | disputeService.js | ❌ Hardcoded |

**Pattern:** All Redis locks use hardcoded `EX` TTLs. No central configuration or reason given for each value.

---

## 4. FAKE / INDICATIVE / NON-EXECUTABLE DATA SOURCES

### Current Architecture (Post-Phase 2)

| Source | Purpose | Binding? | Executable? | Risk |
|--------|---------|----------|---|---|
| **Horizon strict-receive path** | Quote generation | ✅ YES | ✅ YES | Low — proven path |
| **Market maker offers** (fallback) | Fraud check rate | ❌ NO | ❌ NO | Medium — indicative only |
| **Stellar DEX orderbook** (fallback) | Display rates, fallback | ❌ NO | ❌ NO | Medium — spot price, stale |
| **Static USDC/FX rates** | Config defaults | ❌ NO | ❌ NO | High — can drift far from real |
| **Admin input rates** | Manual overrides | ❌ NO | ❌ NO | High — requires trust |

### Specific Non-Executable Assumptions

1. **Fraud checks use legacy rates** (Market maker → DEX → CoinGecko)
   - User requested $1000 equivalent
   - Fraud monitor gets stale DEX mid-market price (1 hour old)
   - Real Horizon path might be significantly different
   - **Risk:** Fraud estimate inaccurate ⚠️

2. **Static USDC/fiat rates** (3750 UGX/USDC default)
   - Used only for fraud, not quotes
   - Could be days out of date if not refreshed
   - Real USDC/UGX rate might be 3600 or 3900
   - **Risk:** Fraud limits become unreliable

3. **Platform spread %** (1.25% default)
   - Applied statically to all users
   - No dynamic adjustment for market volatility
   - No volume-based tiers
   - **Risk:** Margin too high or too low

4. **Quote TTL** (60 or 180 seconds — mismatch!)
   - Quote expires in DB after TTL
   - But frontend doesn't know backend TTL
   - User might see "quote valid" in UI but backend already expired
   - **Risk:** State inconsistency

---

## 5. WHICH HARDCODED VALUES ARE OKAY TO KEEP

These can remain hardcoded or static because they're **design principles**, not **configuration needs**:

| Value | Reason | Impact if Changed |
|-------|--------|-------------------|
| **Stroops/USDC conversion (1M)** | Stellar standard, never changes | Breaking change to Stellar protocol |
| **XLM → USDC path** | Core product design | Major scope expansion |
| **Escrow self-swap** | Architecture choice | Requires escrow redesign |
| **Slippage protection** | Risk management | Changes user cost directly |
| **UI animation delays (200ms, 1.5s)** | UX polish | Visual only, no function |
| **State labels (TX_STATES enum)** | Display labels | Acceptable if kept in sync |
| **Country codes (+256, +254, +255)** | Immutable | Core to mobile money routing |
| **Min phone digits (7)** | Validation rule | Changes user input rules |

---

## 6. WHICH HARDCODED VALUES MUST BE FIXED FIRST

Prioritized by **impact on quote correctness, user trust, execution safety**.

### 🚨 CRITICAL

1. **Double slippage issue** (0.3% quote + 0.5% execution)
   - **Impact:** User could lose 0.8% instead of promised 0.3%
   - **Fix:** Use single slippage source of truth, apply once
   - **Options:**
     - Remove execution slippage, rely on quote slippage only
     - Make execution slippage = quote slippage (0.3%)
     - Store slippage tolerance in quote, read at execution time

2. **MIN_XLM_AMOUNT mismatch** (frontend: 1, backend: 2)
   - **Impact:** User gets quote request success → suddenly rejected
   - **Fix:** Backend must enforce, frontend must read from backend config endpoint
   - **Options:**
     - Create `/api/v1/config/limits` endpoint
     - Frontend fetches on startup
     - Both use same source

3. **Quote TTL mismatch** (backend: 180s default, but code said 60s)
   - **Impact:** Frontend countdown expires before backend, or vice versa
   - **Fix:** Backend must expose TTL in quote response OR config endpoint
   - **Options:**
     - Include `expiresAt` in quote (✅ already done)
     - But ensure frontend uses it for countdown

### 🔴 HIGH

4. **Slippage tolerance should not be hardcoded**
   - **Impact:** Cannot adjust slippage per-network or per-market condition
   - **Fix:** Move to config
   - **Options:**
     - `config.platform.quoteSlippagePercent`
     - Per-network override (e.g., `config.slippagePercentByNetwork`)

5. **KYC fraud limits hardcoded in code**
   - **Impact:** Cannot adjust without redeploy
   - **Fix:** Move to DB or config
   - **Options:**
     - Create `kyc_limits` table, load on startup
     - Move to env vars: `KYC_LIMIT_NONE_PER_TX`, `KYC_LIMIT_BASIC_DAILY`, etc.

6. **USDC asset hardcoded in path discovery**
   - **Impact:** Cannot support other stablecoins
   - **Fix:** Make asset configurable
   - **Options:**
     - Add `config.stellar.quoteAsset` parameter
     - Support multiple assets with dynamic path discovery

7. **State labels must sync**
   - **Impact:** New states added to DB won't display in UI
   - **Fix:** Move to shared constants or API response
   - **Options:**
     - Create `/api/v1/config/states` endpoint returning valid TX states
     - Frontend reads instead of hardcoding TX_STATES

### 🟡 MEDIUM

8. **Lock TTLs scattered and magical**
   - **Impact:** Cannot tune without code review
   - **Fix:** Move to config with explanations
   - **Options:**
     - `REDIS_LOCK_DEPOSIT_TTL_SECONDS: 120`
     - `REDIS_LOCK_RELEASE_TTL_SECONDS: 60`
     - etc.

9. **Static USDC→fiat rates can drift**
   - **Impact:** Fraud checks become inaccurate if not refreshed
   - **Fix:** Implement rate refresh job
   - **Options:**
     - Cron job to fetch live rates every 1h
     - Fall back to static if live fetch fails

10. **Execution timing assumptions**
    - **Impact:** `STELLAR_TX_TIMEOUT_SECONDS = 180` hardcoded in frontend
    - **Fix:** Backend should tell frontend how long to wait
    - **Options:**
      - Include `estConfirmationTimeMs` in quote response
      - Frontend uses that instead of hardcoded 180s

### 🟢 LOW

11. **UI timeouts and thresholds**
    - **Impact:** Minor UX effects
    - **Fix:** Can stay hardcoded for now, move to config later

---

## 7. RECOMMENDED REPLACEMENT SOURCES

For each critical hardcoded value, where should the "source of truth" live?

| Hardcoded Value | Recommended Source | Why | Implementation Effort |
|---|---|---|---|
| **Slippage %** (0.3% / 0.5%) | `config.platform.quoteSlippagePercent` | Different per-market volatility | 🟢 LOW — single env var |
| **MIN_XLM_AMOUNT** | Backend config endpoint `/api/v1/config/limits` | Shared between mobile and web | 🟠 MEDIUM — new endpoint |
| **Quote TTL** | Already in quote response (`expiresAt`) | Quote tells user expiry | 🟢 LOW — use existing |
| **KYC fraud limits** | `kyc_limits` table (DB) or `config.kyc.*.perTx` | Admin-updatable without redeploy | 🟠 MEDIUM — DB design |
| **USDC asset** | `config.stellar.quoteAsset` OR `config.stellar.quoteAssets[]` | Enable future stablecoin support | 🔴 HIGH — path logic refactor |
| **State labels** | `/api/v1/config/states` endpoint | Shared source of truth | 🟠 MEDIUM — new endpoint |
| **Lock TTLs** | Config env vars: `LOCK_TTL_*` | Fine-tune per deployment | 🟢 LOW — 4 new env vars |
| **Execution slippage** | Same as quote slippage | Simplify, remove duplicate | 🟢 LOW — delete line 313 |
| **Static USDC/fiat rates** | Admin panel + hourly refresh job | Keep override capability | 🟠 MEDIUM — UI + cron |
| **Execution timeout** | Quote response: `confirmationTimeEstimateMs` | Backend knows ledger speed | 🟠 MEDIUM — add field |

---

## 8. FINAL SUMMARY

### Biggest Hardcoded Risk in Current Cashout Flow

**🚨 CRITICAL: Double Slippage + Quote/Execution Divergence**

The quote engine promises users **0.3% slippage protection** via `xlmWithSlippage = xlmNeeded * 1.003`, but execution applies **0.5% slippage** separately via `sendMax = xlmSendMax * 1.005`.

**Result:** User could be hit with **0.8% total slippage** instead of 0.3%, losing **0.5% extra**.

**Example:**
- Quote: "Send 100 XLM, receive USDC_X, 0.3% slippage"
- Execution: `sendMax = 100.3 * 1.005 = 100.8 XLM`
- User overpays 0.5 XLM unexpectedly

---

### Safest Quick Wins

1. **Remove execution slippage** (0.5%) — keep quote slippage only (0.3%)
   - 5-minute fix
   - Eliminates double-dipping
   - No breaking changes

2. **Expose min/max limits via config endpoint** — create `/api/v1/config/cashout-limits`
   - Frontend fetches on boot
   - Eliminates MIN_XLM_AMOUNT mismatch
   - 15-minute fix

3. **Move slippage to config** — `QUOTE_SLIPPAGE_PERCENT=0.3` env var
   - Makes it tunable per-deployment
   - 10-minute fix
   - Just move line 11 to config.js

---

### What Should Be Replaced First

**1. Top priority:** Double slippage (remove execution 0.5%)  
**2. Second:** MIN_XLM_AMOUNT mismatch via config endpoint  
**3. Third:** Move slippage to config + move lock TTLs to config  
**4. Fourth:** KYC limits from hardcoded to DB table  
**5. Fifth:** USDC asset support (future stablecoins)  

---

### Is Cashout Flow Still Too Dependent on Hardcoded Assumptions?

**Status: Moderately risky**, but Phase 2 improved it significantly:

✅ **IMPROVED POST-PHASE 2:**
- Quote now uses real Horizon paths (not indicative rates)
- Quote binding to actual executable amounts
- Error handling for "no path" scenarios

❌ **STILL RISKY:**
- Double slippage penalty (0.3% + 0.5%)
- Frontend/backend config misalignment (MIN_XLM, TTL, states)
- KYC fraud limits hardcoded (no admin knob)
- USDC asset hardcoded (no future stablecoin support)
- Lock TTLs magical and scattered
- State enums not synced between frontend/backend

**Verdict:** Phase 2 fixed the **quote correctness** (binding to executable paths), but the system still has **operational brittleness** in:
- Configuration management
- Frontend/backend synchronization
- Multi-asset support
- Fraud rule tuning

**Recommendation:** In next sprint, create a **Config/Constants unification pass**:
- Move all operational thresholds to config
- Create config endpoints for frontend
- Reduce hardcoded values by ~40%
- Improve operational flexibility

---

## END OF AUDIT

**Read-only report completed.**  
**No code changes made.**  
**All findings documented for future remediation.**
