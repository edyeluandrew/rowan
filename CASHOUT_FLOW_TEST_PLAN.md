# Phase 3 Cashout Flow & Trader Portal Test Plan

**Date:** May 7, 2026  
**Focus:** End-to-end testing of Phase 3 bug fix with cashout flow and trader portal  
**Status:** Ready to test

---

## 🎯 Test Objectives

After the Phase 3 bug fix, verify:
1. ✅ User can create cashout request
2. ✅ Trader can receive and accept request
3. ✅ Trader can mark payment as sent
4. ✅ User can confirm receipt
5. ✅ **USDC is released to trader (THE FIX)**
6. ✅ Float accounting completes correctly
7. ✅ Transaction reaches COMPLETE state

---

## 📍 Environment Setup

### Prerequisites
- Backend running: `http://localhost:3000` (or Render deployment)
- Frontend running: `http://localhost:5173` (or Vercel deployment)
- Test trader account created and verified
- Test user account with XLM balance

### Quick Setup
```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend (User Portal)
cd frontend
npm run dev

# Terminal 3: Admin Portal (Monitor transactions)
cd admin
npm run dev
```

---

## 🧪 Full Cashout Flow Test

### Step 1: Create Cashout Request (User Portal)

**URL:** `http://localhost:5173/`

**Action:**
1. Sign up or log in as a user
2. Go to Wallet or Cashout section
3. Enter amount: `10 XLM`
4. Select network: `M-PESA` (Kenya) or `Airtel Money` (Uganda)
5. Enter phone number: e.g., `+254700000001`
6. Click "Get Quote"

**Expected Response:**
```json
{
  "quoteId": "uuid...",
  "memo": "memo_string",
  "escrowAddress": "GXXXXXXX",
  "xlmAmount": 10,
  "userRate": 50.25,
  "fiatAmount": 502.50,
  "fiatCurrency": "KES",
  "platformFee": 25.00,
  "expiresAt": "2026-05-07T12:15:00Z"
}
```

**Backend Endpoint:** `POST /api/v1/cashout/quote`

**What Happens Behind Scenes:**
- ✅ Quote created in `quotes` table
- ✅ State: `QUOTE_REQUESTED`
- ✅ Quote expires in 5 minutes
- ✅ Memo generated for Horizon deposit tracking

---

### Step 2: Send XLM to Escrow (Wallet)

**Action:**
1. User sees escrow address
2. User signs XLM payment from their wallet with memo
3. User submits transaction

**Expected Behavior:**
- XLM sent to `GXXXXXXX` with memo
- User gets transaction hash
- Backend Horizon watcher detects deposit
- Transaction created in `transactions` table
- State: `ESCROW_LOCKED`

**Verification Endpoint:** `GET /api/v1/cashout/status/{transactionId}`

---

### Step 3: Swap XLM → USDC (Backend Auto)

**What Happens:**
- Escrow receives XLM confirmation
- XLM converted to USDC via Horizon path finding
- USDC locked in escrow account
- State: `ESCROW_LOCKED` (still)

**Duration:** 5-10 seconds

---

### Step 4: Trader Matching (Backend Auto)

**What Happens:**
- Matching engine finds best trader for:
  - Network: M-PESA/Airtel
  - Currency: KES/UGX
  - Amount: > min_amount, < max_amount
  - Available float: ≥ required amount
  - Trust score: highest
  - Load: lowest active transactions
- **Phase 3 Float:** Reserved in trader's payout setting
- Trader notified
- State: `TRADER_MATCHED`

**Check in Admin Portal:**
```
Admin → Transactions → Filter by state "TRADER_MATCHED"
```

---

### Step 5: Trader Accepts Request (Trader Portal)

**URL:** `http://localhost:5173` (but Trader Portal - different app)

**Action:**
1. Trader logs in
2. Goes to "Active Requests" or "Pending Cashouts"
3. Sees list of matched requests
4. Clicks on request with amount (e.g., "502.50 KES")
5. Clicks "Accept Request"

**Backend Endpoint:** `POST /api/v1/trader/requests/{id}/accept`

**What Happens:**
- Transaction accepted by trader
- State: `TRADER_MATCHED` (no change yet)
- Trader locked in
- Cannot decline without penalty

---

### Step 6: Trader Marks Payment Sent (Trader Portal)

**URL:** Trader Portal - Active Request Detail

**Action:**
1. Trader receives payment confirmation from their M-PESA/Airtel account
2. Clicks "Mark Payment Sent" or "Payment Submitted"
3. Enters payout reference: e.g., `TXN123456789`
4. Clicks "Submit"

**Backend Endpoint:** `POST /api/v1/trader/requests/{id}/payout-sent`

**What Happens:**
- Transaction updated with `payout_reference`
- **State: `FIAT_PAYOUT_SUBMITTED`** ← NEW STATE
- User notified: "Payment sent by trader, please confirm receipt"
- Trader cannot modify request anymore
- Float stays reserved

**Verification:**
```bash
# Check state in database
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3000/api/v1/admin/transactions | grep state
```

---

### Step 7: User Confirms Receipt (User Portal)

**URL:** User Portal - Transaction History or Active Cashout

**Action:**
1. User goes to "Active Transactions" or "History"
2. Sees transaction in "Awaiting Confirmation" state
3. User checks their M-PESA/Airtel account: payment received ✅
4. Clicks "Confirm Received"
5. Confirms action in modal

**Backend Endpoint:** `POST /api/v1/user/transactions/{id}/confirm-receipt`

**Flow (After Phase 3 Bug Fix):**
1. State transitions: `FIAT_PAYOUT_SUBMITTED` → `USER_CONFIRMATION_PENDING`
2. Calls `escrowController.releaseToTrader(transactionId)`
3. **State check: `WHERE state = 'USER_CONFIRMATION_PENDING'`** ← FIXED ✅
4. **Transaction FOUND** ✅ (before: FIAT_SENT not found ❌)
5. Validates trader stellar address ✅
6. Checks trader USDC trustline ✅
7. Builds Stellar payment operation
8. Submits to Stellar
9. Gets release hash
10. State: `USER_CONFIRMATION_PENDING` → `COMPLETE` ✅ (NOW WORKS)
11. Calls `payoutSettingsService.finalizeFloat()` ✅
12. Response: Success with stellar hash

**Expected Response:**
```json
{
  "status": "COMPLETE",
  "message": "Receipt confirmed. USDC has been released to the trader.",
  "stellarReleaseTx": "hash...",
  "transactionId": "uuid..."
}
```

---

### Step 8: Float Finalization (Backend Auto)

**What Happens:**
- Float finalization triggered (line 540 in escrowController.js)
- Updates trader payout settings:
  - `available_float -= fiat_amount`
  - `reserved_float -= fiat_amount`
- Trader's net available float: `available_float - reserved_float` reduced

**Verification:**
```bash
# Check float in database
SELECT available_float, reserved_float 
FROM trader_payout_settings 
WHERE id = '{payout_setting_id}'
```

---

### Step 9: Transaction Complete (Backend Auto)

**What Happens:**
- State: `COMPLETE` (terminal state)
- Timestamp: `completed_at` set to NOW()
- Revenue tracked: `platform_revenue_ugx` calculated
- Volume tracked: `traders.daily_volume` updated
- Both user and trader notified
- Transaction closed

**Verification:**
```bash
# Check transaction
curl -H "Authorization: Bearer USER_TOKEN" \
  http://localhost:3000/api/v1/user/transactions/{id}
```

**Response shows:**
```json
{
  "id": "uuid...",
  "state": "COMPLETE",
  "stellar_release_tx": "hash...",
  "completed_at": "2026-05-07T12:10:45Z",
  "platform_revenue_ugx": 1250,
  "fiat_amount": 502.50
}
```

---

## 📊 Test Verification Checklist

### User Experience
- [ ] User can create quote
- [ ] Quote expires correctly
- [ ] User can send XLM
- [ ] User sees transaction status updates in real-time
- [ ] User can confirm receipt
- [ ] User gets success notification with release hash
- [ ] User can see transaction in history with state COMPLETE

### Trader Experience
- [ ] Trader receives request notification
- [ ] Trader can accept request
- [ ] Trader can enter payout reference
- [ ] Trader can mark payment sent
- [ ] Trader sees transaction in "Active Requests"
- [ ] Trader receives notification when user confirms
- [ ] Trader's float account updates correctly

### Backend Operations
- [ ] Quote created with correct rates
- [ ] Transaction created with state QUOTE_REQUESTED
- [ ] Horizon deposit detected → state ESCROW_LOCKED
- [ ] Trader matched with correct criteria
- [ ] Float reserved on match
- [ ] State transitions: TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED → USER_CONFIRMATION_PENDING → COMPLETE
- [ ] **releaseToTrader finds USER_CONFIRMATION_PENDING** (THE FIX)
- [ ] Stellar payment submitted successfully
- [ ] Float finalized after COMPLETE
- [ ] Revenue/volume tracked

### Database State
- [ ] Transaction has correct state at each step
- [ ] payout_setting_id is populated
- [ ] Float: reserved_float increased on match, decreased on finalize
- [ ] Float: available_float decreased only on finalize (not on reserve)
- [ ] Timestamps: trader_matched_at, fiat_payout_submitted_at, user_confirmation_pending_at, completed_at

### Notifications
- [ ] Trader notified: Request matched
- [ ] Trader notified: Payment timeout warning (if slow)
- [ ] User notified: Trader marked payment sent
- [ ] User notified: Transaction complete (with release hash)
- [ ] Both notified: via WebSocket real-time and email

---

## 🚨 Critical Test: The Phase 3 Bug Fix

**This is the test that validates the bug fix:**

### Before Fix (❌ Broken)
```
User confirms receipt
  → State: USER_CONFIRMATION_PENDING
  → Call: escrowController.releaseToTrader()
  → Query: WHERE state = 'FIAT_SENT'
  → Result: NULL ❌
  → Release blocked → RELEASE_BLOCKED state
  → USDC never sent ❌
```

### After Fix (✅ Working)
```
User confirms receipt
  → State: USER_CONFIRMATION_PENDING
  → Call: escrowController.releaseToTrader()
  → Query: WHERE state = 'USER_CONFIRMATION_PENDING'
  → Result: FOUND ✅
  → Release proceeds
  → USDC sent ✅
  → State: COMPLETE ✅
```

**Validation Steps:**
1. Enable debug logging in escrowController.js
2. Run through full flow
3. Check logs for:
   ```
   [Escrow] Finalized float for tx {id}: setting {payout_setting_id}, amount {amount}
   [Escrow] tx {id}: USER_CONFIRMATION_PENDING → COMPLETE
   ```
4. Verify trader receives USDC in Stellar account
5. Verify transaction shows state: COMPLETE

---

## 📱 Testing Across Platforms

### Web Frontend (User)
- Chrome: `http://localhost:5173`
- Firefox: `http://localhost:5173`
- Safari: `http://localhost:5173`

### Web Admin (Trader)
- Chrome: `http://localhost:3001` (if separate admin app)

### Mobile (If Available)
- iOS: Build via Xcode from rowan-mobile/
- Android: Build via Android Studio from rowan-mobile/

---

## 🔧 Troubleshooting

### Issue: Quote expires immediately
**Solution:** Check `config.platform.quoteExpirySeconds` in backend config

### Issue: No trader matched
**Solution:** 
- Verify test trader exists and is VERIFIED status
- Check trader has payout_settings with correct network/currency
- Verify trader has available_float >= fiat_amount
- Check trader daily_limit hasn't been exceeded

### Issue: Release fails with trustline error
**Solution:**
- Verify trader stellar address is correct
- Verify trader has USDC trustline in their account
- Check Stellar account at https://stellar.expert/

### Issue: Float not decremented
**Solution:**
- Verify finalizeFloat was called (check logs)
- Check payout_setting_id is populated on transaction
- Verify transaction state is COMPLETE

### Issue: Notifications not showing
**Solution:**
- Check WebSocket connection in browser DevTools
- Verify notificationService is initialized
- Check push token registration

---

## 📈 Performance Metrics to Verify

- Quote generation: < 500ms
- Trader matching: < 2 seconds
- USDC swap: 5-10 seconds
- Release submission: < 1 second
- Total flow time: 30-60 seconds

---

## ✅ Sign-Off Checklist

After completing all tests:

- [ ] User can complete full cashout from start to finish
- [ ] Trader can accept and process requests
- [ ] User confirmation triggers USDC release (THE FIX)
- [ ] Transaction reaches COMPLETE state
- [ ] Float is deducted correctly
- [ ] No double-releases (test by refreshing page)
- [ ] Dispute flow blocked correctly
- [ ] All notifications sent
- [ ] All database states correct
- [ ] Logs show expected flow
- [ ] No errors in console
- [ ] Phase 3 is production-ready ✅

---

## 🚀 Next Steps

1. Run through full test
2. Document any issues
3. Verify all 10 verification criteria pass
4. Get stakeholder sign-off
5. Deploy to production (Render.com)
6. Monitor first 24 hours of transactions
7. Celebrate Phase 3 completion! 🎉

