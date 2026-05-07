# Phase 3 Cashout Flow - Quick Start Test Guide

**Goal:** Test the complete cashout flow with the Phase 3 bug fix in place.

---

## ⚡ Quick Start (5 minutes)

### 1. Verify Deployment

Check that Phase 3 fix is deployed:

```bash
# Check deployed commit hash
cd c:\Users\KAB-STUDENT\rowan
git log --oneline -3

# Should show: Phase 3: Fix critical state machine bug commit
```

### 2. Verify Backend is Running

```bash
# Check if backend is accessible
curl http://localhost:3000/api/v1/health

# Should return 200 OK with health status
```

### 3. Create Test Trader (If Needed)

```bash
# Terminal: Backend directory
cd backend
node setup-test-trader.mjs

# This creates trader with:
# - Email: trader@test.com
# - Password: password123
# - Float: 500,000 KES
# - Networks: M-PESA, Airtel Money
# - Status: VERIFIED
```

### 4. Create Test User (If Needed)

Via frontend sign-up flow or database:
```bash
# Manually create in database
INSERT INTO users (phone_hash, created_at) VALUES 
  (SHA256('1234567890'), NOW());
```

---

## 🧪 Full Test Flow (Manual Steps)

### Scenario: User in Kenya cashing out 10 XLM for 502.50 KES

### **Step 1: User Portal - Create Quote** (2 min)

1. Open: http://localhost:5173
2. Sign up or log in
3. Go to Cashout/Wallet section
4. Enter:
   - Amount: `10` XLM
   - Network: `M-PESA` 
   - Phone: `+254700000001`
5. Click "Get Quote"

**Verify:**
- ✅ Quote appears with rates
- ✅ Response includes `quoteId`, `memo`, `escrowAddress`

### **Step 2: Send XLM to Escrow** (3 min)

1. Copy escrow address from quote
2. Open Stellar wallet (LOBSTR, Stellar.org, etc.)
3. Send 10 XLM to escrow address
4. **CRITICAL:** Add memo from quote as **text memo**
5. Sign and submit transaction
6. Copy stellar transaction hash

**Verify:**
- ✅ Transaction submitted successfully
- ✅ Got transaction hash back

### **Step 3: Wait for Horizon Detection** (5 sec)

Return to frontend - should see transaction progressing.

**Or verify via backend:**
```bash
curl http://localhost:3000/api/v1/cashout/status/{memo} \
  -H "Authorization: Bearer {USER_TOKEN}"

# Should show state progressing through states
```

### **Step 4: Trader Portal - Accept Request** (2 min)

1. Open trader portal (http://localhost:3001 or separate app)
2. Log in as: `trader@test.com` / `password123`
3. Go to "Active Requests" or "Pending"
4. Find request with 502.50 KES
5. Click "Accept"

**Verify:**
- ✅ Request accepted
- ✅ Button changes or disappears
- ✅ Can no longer accept/decline

### **Step 5: Trader Marks Payment Sent** (1 min)

1. Still in trader portal
2. Click "Mark Payment Sent" on accepted request
3. Enter payout reference: `TEST123456`
4. Click "Submit"

**Verify:**
- ✅ Payment marked as sent
- ✅ Status updates to "Awaiting User Confirmation"
- ✅ Trader gets notification

**Backend Check:**
```bash
curl http://localhost:3000/api/v1/admin/transactions \
  -H "Authorization: Bearer {ADMIN_TOKEN}" | \
  grep -A5 "state.*FIAT_PAYOUT_SUBMITTED"
```

### **Step 6: User Confirms Receipt** (1 min) 🔴 **THE CRITICAL TEST**

1. Return to user portal
2. Go to "Active Transactions"
3. Find transaction marked as "Awaiting Confirmation"
4. Click "Confirm Received"
5. Confirm in modal

**Expected Behavior (Phase 3 Fix):**
- ✅ Modal confirms: "Receipt confirmed. USDC released to trader."
- ✅ Stellar transaction hash displayed
- ✅ Transaction moves to "Completed" in history
- ✅ No errors

**If Bug Not Fixed:**
- ❌ Error: "Release failed"
- ❌ Transaction stuck in "Awaiting Confirmation"
- ❌ USDC never sent

### **Step 7: Verify Completion** (1 min)

**Check User Portal:**
- ✅ Transaction shows state: `COMPLETE`
- ✅ Stellar release hash visible
- ✅ Completion timestamp shows

**Check Trader Portal:**
- ✅ Request no longer appears in active
- ✅ Appears in "Completed" history
- ✅ Float reduced correctly

**Check Database:**
```bash
# Verify transaction state
psql $DATABASE_URL -c \
  "SELECT id, state, completed_at, stellar_release_tx FROM transactions 
   WHERE trader_id = '{trader_id}' 
   ORDER BY created_at DESC LIMIT 1;"

# Should show: state = COMPLETE, stellar_release_tx = filled, completed_at = recent

# Verify float finalized
psql $DATABASE_URL -c \
  "SELECT available_float, reserved_float FROM trader_payout_settings 
   WHERE id = '{payout_setting_id}';"

# Should show: both decreased by transaction amount
```

**Check Stellar Account:**
```bash
# Verify USDC in trader's wallet
# Go to: https://stellar.expert/explorer/public/account/{trader_stellar_address}
# Should see +502.50 USDC (or appropriate amount)
```

---

## ✅ Validation Checklist

Run through and verify all:

- [ ] Quote created successfully
- [ ] XLM sent to escrow address
- [ ] Trader matched and received notification
- [ ] Trader accepted request
- [ ] Trader marked payment sent (state: FIAT_PAYOUT_SUBMITTED)
- [ ] User confirmed receipt successfully
- [ ] **NO ERROR** about state not found ← THE FIX
- [ ] USDC released (got stellar hash)
- [ ] Transaction state: COMPLETE
- [ ] Float decreased correctly
- [ ] Trader's wallet shows USDC received

**All ✅ means Phase 3 bug fix is working!**

---

## 🐛 If Test Fails

### Failure: "Release failed" or transaction stuck

**Root Cause:** State name bug not fixed (FIAT_SENT vs USER_CONFIRMATION_PENDING)

**Check:**
```bash
# Verify escrowController has the fix
grep -n "WHERE t.id = \$1 AND t.state =" backend/src/services/escrowController.js

# Should show line 428:
# WHERE t.id = $1 AND t.state = 'USER_CONFIRMATION_PENDING'

# NOT:
# WHERE t.id = $1 AND t.state = 'FIAT_SENT'
```

**If Not Fixed:**
```bash
# Re-apply fix manually
# Edit backend/src/services/escrowController.js
# Lines 428, 470, 532 should use USER_CONFIRMATION_PENDING
```

### Failure: Trader float not decreased

**Check:**
```bash
# Verify payout_setting_id is set on transaction
psql $DATABASE_URL -c \
  "SELECT payout_setting_id FROM transactions LIMIT 1;"

# Should not be NULL

# If NULL, float finalization won't work
```

### Failure: No USDC in trader wallet

**Check:**
1. Verify trader stellar address is correct
2. Verify trader has USDC trustline
3. Check Stellar for errors in transaction logs

---

## 📊 Logs to Check

**Backend Logs (Check for these messages):**

```
# Quote created
[Cashout] ✅ Quote created: memo={memo}, xlmAmount={amount}

# Trader matched
[Matching] Matched tx {txId} → trader {name}
[Matching] Reserved float for tx {txId}: setting {id}, amount {amount}

# Payment sent
[Trader] Trader {traderId} submitted payout for tx {txId}
[submitPayoutSent] ✅ Trader {traderId} submitted payout for tx {txId}, state now: FIAT_PAYOUT_SUBMITTED

# User confirmation (THIS IS THE KEY LOG FOR THE FIX)
[User] Transitioned tx {txId} to USER_CONFIRMATION_PENDING
[Escrow] tx {txId}: USER_CONFIRMATION_PENDING → COMPLETE  ← Shows the fix worked!
[Escrow] Finalized float for tx {txId}: setting {id}, amount {amount}
```

**If you see:**
```
[Escrow] Transaction not found or wrong state
```

This means state name bug is NOT fixed (looking for FIAT_SENT instead of USER_CONFIRMATION_PENDING)

---

## ⏱️ Timeline

| Phase | Duration | Action |
|-------|----------|--------|
| Quote | 2 min | User creates quote |
| Deposit | 3 min | User sends XLM to escrow |
| Detection | 5 sec | Horizon detects deposit |
| Swap | 5 sec | XLM → USDC conversion |
| Matching | 2 sec | Trader found and matched |
| Trader Accept | 1 min | Trader accepts request |
| Payment Sent | 1 min | Trader marks payment sent |
| **Confirmation** | **1 min** | User confirms - **THE FIX** |
| **Release** | **1 sec** | USDC sent to trader - **NOW WORKS** |
| **Total** | **~20 min** | Full flow end-to-end |

---

## 🚀 After Successful Test

1. Document results
2. Check all 10 Phase 3 verification criteria pass
3. Mark Phase 3 as production-ready
4. Deploy to Render.com (already done via git push)
5. Monitor first transactions in production

---

## Questions?

Check logs at:
- Backend: `backend/logs/` or stdout
- Database: `psql $DATABASE_URL`
- Stellar: https://stellar.expert/explorer/

