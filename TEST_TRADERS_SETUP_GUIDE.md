# Test Trader Setup & Matching Verification Guide

## Quick Start

### 1. Create Diverse Test Traders
```bash
cd backend
node setup-diverse-test-traders.mjs
```

This creates 4 traders:
- **trader-mtb-airtel** (MTB + Airtel) - Most flexible
- **trader-airtel-only** (Airtel only)
- **trader-mtn-only** (MTN only)  
- **trader-mpesa-only** (Mpesa only)

Each with 25k-50k KES float and 50k-100k daily limit.

---

## Testing Flow

### Step 1: Create Quote from Wallet
```
1. Open wallet app
2. Enter quote:
   - Amount: 100 KES (or any small amount)
   - Network: Stellar (USDC)
   - Payout Method: Airtel (or any method)
3. Click "Confirm Quote"
4. Wait for quote confirmation
5. Click "Fund Escrow" 
6. Select Airtel as payout method
7. Confirm → Escrow locked
```

**Expected:**
- ✅ Quote created
- ✅ Escrow locked
- ✅ Transaction waiting for trader match

### Step 2: Check Transaction State
```bash
# In terminal, check database
psql $DATABASE_URL -c "
SELECT id, state, payout_method, created_at 
FROM transactions 
WHERE state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED')
ORDER BY created_at DESC 
LIMIT 5;
"
```

**Expected:**
- ✅ Transaction in ESCROW_LOCKED or TRADER_MATCHED
- ✅ payout_method matches what you selected

### Step 3: Monitor Backend Logs
```
Watch Render logs for:

[Matching] Checking for traders with Airtel...
[Matching] Found 3 traders with Airtel capacity
[Matching] Assigned trader trader-mtb-airtel to tx ABC123
[Matching] tx ABC123: ESCROW_LOCKED → TRADER_MATCHED
```

**Problems to look for:**
- ❌ "No eligible traders found" - Check float settings
- ❌ Guard failed - Trader not in ESCROW_LOCKED state
- ❌ No [StateMachine:transition] logs - Matching didn't run

### Step 4: Check Trader App
```
1. Open trader app (or trader window)
2. Go to "Pending Requests"
3. Look for request matching your quote amount
```

**Expected:**
- ✅ Request appears in list
- ✅ Amount, currency, payout method match
- ✅ Countdown timer showing accept deadline

**Problems:**
- ❌ Request not appearing - Matching failed
- ❌ Multiple duplicate requests - Matching ran twice
- ❌ Request shows but is disabled - State issue

### Step 5: Trader Accepts
```
1. Click "Accept" on the request
2. Watch console and logs
```

**Watch for logs:**
```
[acceptRequest:CALLED] tx ABC123, trader XYZ. Caller: [STACK]
[acceptRequest:BEFORE] tx ABC123: state=TRADER_MATCHED, matched_at=null
[acceptRequest:UPDATE] Attempting UPDATE with matched_at = NOW()
```

**Expected:**
- ✅ matched_at gets set
- ✅ Page navigates to request detail
- ✅ Shows payout instructions

**Problems:**
- ❌ 410 error appears - State already progressed (the bug!)
- ❌ State shows FIAT_PAYOUT_SUBMITTED - Auto-progression bug confirmed
- ❌ Guard failed with different state - Something changed it

### Step 6: Submit Payout
```
1. Trader sees "I've Sent Payment" button
2. Click it → Enter reference number
3. Submit
```

**Watch for logs:**
```
[submitPayoutSent:CALLED] tx ABC123, trader XYZ, ref MPESA123. Caller: [STACK]
[StateMachine:transition] CALLED: ABC123 TRADER_MATCHED→FIAT_PAYOUT_SUBMITTED
[StateMachine:SUCCESS] tx ABC123: TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED
```

**Expected:**
- ✅ Reference stored
- ✅ State transitions to FIAT_PAYOUT_SUBMITTED
- ✅ User sees "Money Sent by Trader" on wallet

---

## Key Logs to Monitor

**Matching Phase:**
```
[Matching] Checking for traders with <METHOD>...
[Matching] Found X traders with <METHOD> capacity
[Matching] Selected trader-id for tx TX_ID (score, availability)
[Matching] tx TX_ID: ESCROW_LOCKED → TRADER_MATCHED
```

**Accept Phase (The Debug Phase):**
```
[acceptRequest:CALLED] tx ..., trader .... Caller: [STACK]
[acceptRequest:BEFORE] tx ...: state=..., matched_at=...
[acceptRequest:GUARD_FAILED] (if state is not TRADER_MATCHED - BUG!)
[acceptRequest:UPDATE] (if update succeeds - GOOD)
```

**Payout Phase:**
```
[submitPayoutSent:CALLED] tx ..., trader ..., ref ... Caller: [STACK]
[StateMachine:SUCCESS] ... TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED
```

---

## Troubleshooting

### No Traders Found When Matching
```bash
# Check trader payout settings
psql $DATABASE_URL -c "
SELECT 
  u.name,
  ps.payout_method,
  ps.float_kes,
  ps.is_active
FROM trader_payout_settings ps
JOIN traders t ON ps.trader_id = t.id
JOIN users u ON u.id = t.user_id
ORDER BY ps.payout_method;
"
```

**Fix:** 
- Make sure `is_active = true`
- Make sure `float_kes > 0`
- Make sure payout_method matches what user selected

### Trader Not Seeing Requests
```
1. Check trader state in logs: [Matching] Assigned trader-XYZ
2. Verify socket connection: Network tab → WS shows connected
3. Check browser console for socket errors
4. Refresh trader app page
5. Check if request appears now
```

### 410 Error on Accept (The Bug)
```
This is what we're debugging!

If you see:
[acceptRequest:GUARD_FAILED] Expected TRADER_MATCHED but found FIAT_PAYOUT_SUBMITTED

Then search backwards in logs for:
[submitPayoutSent:CALLED] - shows who auto-submitted
[StateMachine:SUCCESS] TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED - shows when it progressed
```

**Share these logs and we can identify the root cause!**

---

## Database Queries for Testing

### Check Trader Capacity
```sql
SELECT 
  u.name,
  STRING_AGG(ps.payout_method, ', ') as methods,
  SUM(ps.float_kes) as total_float,
  SUM(ps.daily_limit_kes) as total_daily_limit
FROM traders t
JOIN users u ON u.id = t.user_id
JOIN trader_payout_settings ps ON ps.trader_id = t.id
WHERE ps.is_active
GROUP BY t.id, u.name
ORDER BY u.name;
```

### Check Recent Transactions
```sql
SELECT 
  id,
  state,
  payout_method,
  trader_id,
  matched_at,
  created_at,
  updated_at
FROM transactions
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Transaction History
```sql
-- Replace ABC123 with your transaction ID
SELECT 
  id,
  state,
  payout_method,
  trader_id,
  matched_at,
  trader_matched_at,
  fiat_payout_submitted_at,
  created_at
FROM transactions
WHERE id = 'ABC123';
```

---

## What We're Testing

1. **Matching Works** - Traders get assigned correctly ✅
2. **Socket Updates Work** - Traders see requests ✅  
3. **Accept Endpoint Works** - matched_at gets set ✅
4. **State Doesn't Auto-Progress** - 410 error should not appear ❌ (This is the bug)

Once we have these 4 working, the cashout flow will be solid!

---

## Success Criteria

✅ Create quote → Escrow locked
✅ Trader matches → TRADER_MATCHED state
✅ Trader sees request in app
✅ Trader clicks Accept → navigates to detail
✅ Trader submits payout → FIAT_PAYOUT_SUBMITTED
✅ User confirms receipt → COMPLETE
✅ No 410 errors
✅ No state bouncing

---

## Ready to Test?

1. Run: `node setup-diverse-test-traders.mjs`
2. Start wallet app
3. Create quote with Airtel payout
4. Watch logs as trader accepts
5. Share the logs showing what happens!
