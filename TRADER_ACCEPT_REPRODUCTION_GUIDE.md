# Trader Accept 410 Error - Reproduction & Tracing Guide

**Logging Deployed:** `65582667` ✅

Now that detailed logging is in place, we can trace exactly who calls `submitPayoutSent()` and when the state auto-transitions.

---

## Quick Start (5 minutes)

### 1. Restart Backend with New Logging
```bash
# Terminal in rowan/backend
npm stop  # or Ctrl+C if running
npm start
```

Watch for startup logs - should show initialization messages.

### 2. Reproduce the Issue

**In the web app:**

1. **Create a quote**
   - Go to wallet app
   - Enter amount, select trader
   - Confirm quote → This creates ESCROW_LOCKED state

2. **Wait for matching**
   - System finds trader → TRADER_MATCHED state
   - Trader sees request in their pending list

3. **Trader accepts**
   - Switch to trader app / new browser window
   - Click "Accept" button on request
   - **RESULT:** Should get either:
     - ✅ SUCCESS: navigates to detail page (workaround working)
     - ❌ FAILURE: 410 error (original bug)

4. **Check backend logs immediately**
   - Look for `[acceptRequest:CALLED]` log with call stack
   - Look for `[acceptRequest:BEFORE]` log showing the state BEFORE
   - Look for any `[submitPayoutSent:CALLED]` logs

---

## What to Look For in Logs

### Expected (Normal Flow)
```
[acceptRequest:CALLED] tx ABC123, trader XYZ. Caller: at acceptRequest (matchingEngine.js:250) | at ...
[acceptRequest:BEFORE] tx ABC123: trader_id=XYZ, state=TRADER_MATCHED, matched_at=null
[acceptRequest:UPDATE] Attempting UPDATE with matched_at = NOW()
[StateMachine:transition] CALLED: ABC123 TRADER_MATCHED→FIAT_PAYOUT_SUBMITTED (on confirm)
[StateMachine:SUCCESS] tx ABC123: TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED
```

### Bug Evidence (Auto-Progression)
```
[acceptRequest:CALLED] tx ABC123, trader XYZ. Caller: ...
[acceptRequest:BEFORE] tx ABC123: trader_id=XYZ, state=FIAT_PAYOUT_SUBMITTED, matched_at=null
[acceptRequest:GUARD_FAILED] tx ABC123: Expected TRADER_MATCHED but found FIAT_PAYOUT_SUBMITTED
```

**Key question:** Why is the state already FIAT_PAYOUT_SUBMITTED before trader accepted?

### Investigation Clues
Look backwards in the logs to find:

1. **When did state transition to FIAT_PAYOUT_SUBMITTED?**
   - Search for: `[StateMachine:SUCCESS] ${transactionId}: TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED`
   - This will show WHO called the transition

2. **Did submitPayoutSent get called automatically?**
   - Search for: `[submitPayoutSent:CALLED]`
   - Look at the Caller stack trace
   - Should show `backend/src/routes/trader.js` (the `/payout-sent` endpoint)
   - If it shows something else, that's the auto-caller!

3. **Is trader_id changing between assignment and accept?**
   - Look for `trader_id` changes in logs
   - Multiple traders assigned to same request?

---

## Log Locations

### Backend Logs

**If running locally:**
```bash
# Logs should print to console
# Run in terminal and watch output
npm start
```

**If running on Render.com:**
- Go to https://dashboard.render.com
- Select the backend service
- Click "Logs" tab
- Watch logs in real-time or search

**Check logs for this transaction:**
```
Search for: "tx ABC123" (replace ABC123 with actual transaction ID)
```

---

## Diagnostic Queries

### Find Recently Problematic Transactions

```sql
-- Transactions that went TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED quickly
SELECT 
  id,
  state,
  trader_matched_at,
  fiat_payout_submitted_at,
  EXTRACT(EPOCH FROM (fiat_payout_submitted_at - trader_matched_at)) as seconds_to_submit,
  updated_at
FROM transactions
WHERE state IN ('FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING', 'COMPLETE')
  AND fiat_payout_submitted_at IS NOT NULL
  AND trader_matched_at IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
```

If `seconds_to_submit` is very small (< 2 seconds), something auto-transitioned it.

### Check Matched Timestamps

```sql
-- See if matched_at is being set (shows trader accepted)
SELECT 
  id,
  state,
  trader_matched_at,
  matched_at,
  CASE 
    WHEN matched_at IS NULL THEN 'NOT_ACCEPTED'
    WHEN matched_at IS NOT NULL THEN 'ACCEPTED'
  END as accept_status
FROM transactions
WHERE state IN ('TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED')
ORDER BY updated_at DESC
LIMIT 10;
```

If `matched_at IS NULL` but state is `FIAT_PAYOUT_SUBMITTED`, that's the bug - state changed without trader accepting!

---

## Step-by-Step Debugging Process

### Phase 1: Capture the Logs (5 min)
1. Restart backend with new logging
2. Reproduce the issue once
3. Note down the transaction ID from the error message
4. Copy all backend logs to a file

### Phase 2: Analyze Logs (5 min)
1. Search logs for: `[acceptRequest:CALLED]`
2. Search logs for: `[acceptRequest:BEFORE]`
3. Search logs for: `[StateMachine:SUCCESS]` with FIAT_PAYOUT_SUBMITTED
4. Search logs for: `[submitPayoutSent:CALLED]`

### Phase 3: Find the Caller (2 min)
From the `[StateMachine:SUCCESS]` log for FIAT_PAYOUT_SUBMITTED transition:
- It shows the full stack trace of who called it
- Trace backwards to find the root cause

### Phase 4: Code Investigation (10 min)
Once you know who's calling it:
- Open that file/function in editor
- See if it should be calling it automatically
- Check if there's a missing guard condition
- Look for any async/await timing issues

---

## Example Session

**Terminal 1: Backend with logging**
```
$ npm start
[INFO] Server started on port 3001
...
[acceptRequest:CALLED] tx ae8f-1234, trader usr-5678. Caller: POST /api/v1/trader/requests/ae8f-1234/accept (routes/trader.js:225)
[acceptRequest:BEFORE] tx ae8f-1234: trader_id=usr-5678, state=FIAT_PAYOUT_SUBMITTED, matched_at=null
[acceptRequest:GUARD_FAILED] tx ae8f-1234: Expected TRADER_MATCHED but found FIAT_PAYOUT_SUBMITTED
```

**Then search backwards in logs for why state is already FIAT_PAYOUT_SUBMITTED:**
```
[StateMachine:SUCCESS] tx ae8f-1234: TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED | extra: {}
[submitPayoutSent:CALLED] tx ae8f-1234, trader ???, ref null. Caller: routes/trader.js line 280 | ???
```

If `ref null` (reference is null), that's a clue! Someone called it without a reference!

---

## Quick Wins to Check

Before digging into logs, check these things:

1. **Is there a socket event handler that submits payout automatically?**
   ```bash
   grep -r "submitPayoutSent\|payout-sent" backend/src --include="*.js" -n
   ```
   Should only show the `/payout-sent` endpoint

2. **Is there a test script running?**
   ```bash
   grep -r "test.*payout\|submitPayout" backend/src/scripts --include="*.js" -n
   ```

3. **Is there a webhook endpoint?**
   ```bash
   grep -r "webhook\|callback" backend/src/routes --include="*.js" -n
   ```

4. **Is there a background job that auto-submits?**
   ```bash
   grep -r "auto.*payout\|scheduled.*payout" backend/src --include="*.js" -n
   ```

---

## Commit Reference
- **Logging changes:** `65582667`
- **Previous frontend workaround:** `2df4f3ad`
- **Diagnosis guide:** `35ab7455`

---

## Next Actions

Once you've captured the logs:
1. Share the relevant log section with the exact timestamp and transaction ID
2. Or provide the `[submitPayoutSent:CALLED]` call stack showing who called it
3. That will immediately tell us the root cause

---

**Created:** May 8, 2026  
**Status:** Logging deployed, ready for reproduction test
