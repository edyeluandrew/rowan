# Debug: Transaction State Bounce-Back Issue

**Issue**: After trader clicks accept, status bounces back to QUOTE_CONFIRMED (instead of staying in TRADER_MATCHED or progressing)

---

## 🔍 Diagnostic Steps

### 1. Check Database Directly

Connect to your database and run:

```sql
-- Get latest transactions and their states
SELECT 
  id, 
  state, 
  trader_id, 
  matched_at,
  created_at,
  quote_confirmed_at,
  escrow_locked_at,
  trader_matched_at,
  fiat_payout_submitted_at,
  user_confirmation_pending_at
FROM transactions
ORDER BY created_at DESC
LIMIT 10;

-- Look for the specific transaction ID
SELECT * FROM transactions WHERE id = 'YOUR_TX_ID_HERE' \x on;
```

**Expected Progression:**
- created_at → state=QUOTE_REQUESTED
- quote_confirmed_at → state=QUOTE_CONFIRMED  
- escrow_locked_at → state=ESCROW_LOCKED
- trader_matched_at → state=TRADER_MATCHED
- fiat_payout_submitted_at → state=FIAT_PAYOUT_SUBMITTED
- user_confirmation_pending_at → state=USER_CONFIRMATION_PENDING
- completed_at → state=COMPLETE

**If bouncing back:**
- Check if trader_matched_at is NULL or being cleared
- Check if state is actually being set to ESCROW_LOCKED instead of TRADER_MATCHED

---

### 2. Check Logs for Errors

Look for these error patterns:

```bash
# Check for state transition failures
grep -i "transition.*failed\|state.*error\|cannot.*accept" backend.log

# Check for decline events (which reset to ESCROW_LOCKED)
grep -i "declined\|decline" backend.log

# Check for re-matching
grep -i "re-match\|rematch" backend.log
```

**Likely Issues:**
- "Request already progressed to" → means transaction moved beyond TRADER_MATCHED
- "Condition not met" → means WHERE clause failed (state not TRADER_MATCHED)
- "Re-match after decline" → trader declined, not accepted

---

### 3. Trace the Accept Call

Check if acceptRequest is being called and what it returns:

```bash
grep -i "\[Accept\]" backend.log | tail -20
```

**Look for:**
```
[Accept] Before accept: id=..., trader_id=..., state=TRADER_MATCHED, matched_at=null
[Accept] ✅ Accepted: matched_at set to ...
```

**If not found or different:**
- State might not be TRADER_MATCHED
- Trader ID might not match
- matched_at might already be set (already accepted)

---

### 4. Check Quote vs Transaction State

The issue might be confusing QUOTE state with TRANSACTION state!

```sql
-- Check if there's a quote with state QUOTE_CONFIRMED
SELECT 
  q.id as quote_id,
  q.status as quote_status,
  t.id as tx_id,
  t.state as tx_state
FROM quotes q
LEFT JOIN transactions t ON q.id = t.quote_id
WHERE q.id = 'YOUR_QUOTE_ID_HERE'
\x on;
```

**Key Check:**
- `quote.status` should be 'CONFIRMED' (quote has been used)
- `transaction.state` should be TRADER_MATCHED or beyond

---

### 5. Frontend Issue Check

The frontend might be showing the wrong data:

```javascript
// Check if frontend is using:
- transactionId (correct)
- quoteId (should not be used for state tracking)
- quote.status (wrong! should use transaction.state)
```

**Frontend should fetch:**
```
GET /api/v1/cashout/status/:transactionId
```

**NOT:**
```
GET /api/v1/cashout/quote/:quoteId  ← This shows quote status, not tx status
```

---

## 🎯 Root Cause Checklist

- [ ] Transaction state actually stored as QUOTE_CONFIRMED in DB?
  - **Action**: Run query above, check `state` column

- [ ] State rolling back due to decline?
  - **Action**: Check if decline is being triggered
  - **Check logs**: grep for "declined"

- [ ] Frontend querying wrong endpoint?
  - **Action**: Check network tab for `/cashout/status` vs `/cashout/quote`

- [ ] acceptRequest throwing error silently?
  - **Action**: Check logs for [Accept] errors
  - **Check logs**: grep "\[Accept\].*❌\|[Accept].*failed"

- [ ] Race condition with re-matching?
  - **Action**: Check if matchTrader is being called twice
  - **Check logs**: grep "matchTrader\|Re-match"

- [ ] Multiple transactions created?
  - **Action**: Check if user has multiple tx for same quote
  - **Run query**: SELECT * FROM transactions WHERE quote_id = 'X'

---

## 🔧 Quick Debug Command

Run this to see the full transaction lifecycle:

```bash
# Stream backend logs with timestamps
tail -f backend.log | grep -E "\[Escrow\]|\[Accept\]|\[Decline\]|\[Match\]"
```

Then trigger the flow again and watch what happens step-by-step.

---

## ⚠️ Likely Issues in Code

### If state is ESCROW_LOCKED after accept:
- Trader probably declined (sets state back to ESCROW_LOCKED)
- Check: `trader.requests` endpoint shows "TRADER_MATCHED" but DB shows "ESCROW_LOCKED"

### If state is QUOTE_CONFIRMED:
- A NEW transaction might have been created for same quote
- Check: `SELECT * FROM transactions WHERE quote_id = 'X'` (should only be 1)
- Or quote is being re-used (DB should prevent this with `is_used = TRUE`)

### If matched_at is NULL after accept:
- acceptRequest failed silently
- WHERE clause didn't match (trader_id wrong, state wrong, etc.)
- Check logs for [Accept] error messages

---

## Next Steps

1. **Provide Database State**: Run the SQL queries above and share the results
2. **Provide Recent Logs**: Share grep output showing the accept flow
3. **Provide Frontend Network Tab**: Screenshot of `/cashout/status` response after accepting
4. **Verify Transaction ID**: Is frontend using transactionId or quoteId?

Once I have this info, I can pinpoint the exact issue!
