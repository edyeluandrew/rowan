# Trader Accept 410 Error - Debugging Guide

**Status:** Frontend workaround ✅ DEPLOYED | Backend root cause 🔍 INVESTIGATING

---

## Quick Summary

**The Problem:** Traders get 410 (Gone) error when clicking "Accept" because requests auto-transition from `TRADER_MATCHED` to `FIAT_PAYOUT_SUBMITTED` before they can accept.

**Frontend Fix Applied:** ✅ Graceful 410 handler now navigates to detail page instead of showing error.

**Backend Root Cause:** Still unknown - need to trace execution path.

---

## What We Know (Verified)

✅ **NOT the cause:**
- `submitPayoutSent()` is only called from `/requests/:id/payout-sent` endpoint (manual trader action)
- Job queue doesn't auto-submit: `reMatchQueue` only does timeout re-matching, `orphanRecovery` only handles refunds
- Frontend RequestDetail.jsx has no auto-submit logic on mount/update
- Frontend RequestCard.jsx only calls `acceptRequest()` when user clicks button

✅ **Confirmed transition happening:**
- ESCROW_LOCKED → TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED (without trader accept in between)
- Backend logs show this progression (from conversation summary)

---

## Debugging Steps (For Backend Investigation)

### Step 1: Add Detailed Logging

**File:** `backend/src/services/transactionStateMachine.js`

Add logging to track ALL state transitions:

```javascript
// At the beginning of transition() function, add:
async transition(transactionId, fromState, toState, metadata = {}) {
  const stack = new Error().stack;
  logger.info(`[StateMachine] Transition START: tx ${transactionId}`, {
    from: fromState,
    to: toState,
    metadata,
    caller: stack.split('\n')[2], // Show immediate caller
  });
  
  // ... existing code ...
  
  logger.info(`[StateMachine] Transition COMPLETE: tx ${transactionId} now in ${toState}`);
}
```

### Step 2: Trace submitPayoutSent Calls

**File:** `backend/src/services/matchingEngine.js`

Add logging at the start:

```javascript
async function submitPayoutSent(transactionId, traderId, payoutReference) {
  const callerTrace = new Error().stack;
  logger.warn(`[submitPayoutSent] CALLED from:`, callerTrace);
  
  // ... rest of function ...
}
```

### Step 3: Search for Hidden API Calls

Check if there's any endpoint that auto-calls payout-sent:

```bash
grep -r "submitPayoutSent" backend/src --include="*.js"
grep -r "payout-sent" backend/src --include="*.js"
grep -r "/requests.*payout" backend/src --include="*.js"
```

### Step 4: Check for Admin/Automated Triggers

Search for any admin or background endpoints:

```bash
grep -r "admin.*payout\|auto.*payout\|scheduled.*payout" backend/src --include="*.js"
```

### Step 5: Check Database Triggers

**File:** `backend/supabase/migrations/*.sql`

Look for any PostgreSQL triggers that might auto-transition state:

```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND (trigger_name LIKE '%payout%' OR trigger_name LIKE '%auto%');
```

---

## Hypothesis: Multiple Traders Being Assigned

**Theory:** If multiple traders can be assigned to the same request, one trader might submit payout while another is trying to accept.

**Test:**
```sql
-- Check if trader_id is unique
SELECT trader_id, COUNT(*) 
FROM transactions 
WHERE state = 'TRADER_MATCHED' 
GROUP BY trader_id 
HAVING COUNT(*) > 1;

-- Check if one request has multiple traders (shouldn't happen)
SELECT id, trader_id, COUNT(DISTINCT trader_id) as trader_count
FROM transactions
WHERE state IN ('TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED')
GROUP BY id, trader_id;
```

---

## Hypothesis: Socket Event Race Condition

**Theory:** A socket event might be triggering state changes on one connection while another is processing.

**Test:** Add logging to socket event handlers:

```javascript
// In backend socket handlers
socket.on('accept_request', async (data) => {
  const now = new Date().toISOString();
  logger.warn(`[Socket:accept] Event received at ${now}, tx ${data.id}`);
  // ... handler code ...
  logger.warn(`[Socket:accept] Event completed at ${new Date().toISOString()}`);
});
```

---

## Hypothesis: Webhook or Third-Party Service

**Theory:** External webhook or integration calling submitPayoutSent.

**Search locations:**
- Check for webhook handlers in `backend/src/routes/`
- Search for any `fetch()` or HTTP calls to payout endpoints
- Check if any background job triggers manual API call

```bash
grep -r "webhook\|callback\|hook" backend/src --include="*.js"
grep -r "fetch.*payout\|axios.*payout\|post.*payout" backend/src --include="*.js"
```

---

## Quick Test You Can Run Now

1. **Get a request in TRADER_MATCHED state**
   - Create quote, fund escrow, get matched to trader
   - Stop BEFORE trader clicks accept

2. **Open two browser windows** (same trader logged in)
   - Window A: Request list page
   - Window B: Request detail page (from URL, not navigating from list)

3. **Check database state:**
   ```sql
   SELECT id, state, trader_id, matched_at, updated_at
   FROM transactions
   ORDER BY updated_at DESC
   LIMIT 5;
   ```

4. **In Window A:** Click "Accept"  
   **In Window B:** Simultaneously, open browser dev tools → Network tab → watch for any API calls

5. **Expected:** Either accept succeeds or fails with 410
   **Check:** Are TWO requests being sent? One accept + one payout-sent?

---

## Log Files to Check

After reproducing the issue, check:

1. **Backend logs:** Look for sequence of events around the timestamp when it failed
   - Search for the transaction ID in logs
   - Look for ANY mention of FIAT_PAYOUT_SUBMITTED transition
   - Find WHO called submitPayoutSent (should only be `/payout-sent` endpoint)

2. **Frontend console:** Any errors or network requests?
   - Open DevTools → Network → look for POST /payout-sent
   - Console → search for "accept" or "410"

3. **Database logs:** 
   ```sql
   -- If you have audit logging enabled
   SELECT * FROM audit_log 
   WHERE entity = 'transactions'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

---

## Next Steps

1. **Apply the logging** from Step 1-2 above
2. **Reproduce the issue** and capture logs
3. **Search logs** for the state transition point
4. **Find the caller** - Who's calling submitPayoutSent?
5. **Fix** - Remove or guard that call

---

## Current Frontend Fix Details

**File:** `rowan-mobile/src/trader/components/cards/RequestCard.jsx`

When `acceptRequest()` gets a 410 error:
- ✅ Auto-navigates to request detail page
- ✅ Shows the current state to the trader
- ✅ Prevents confusing error alert
- ⚠️ Masks the underlying bug (still need to fix backend)

---

## Questions for Root Cause

Once you find the caller:

1. **Is it supposed to call submitPayoutSent automatically?** (Probably not)
2. **Who is supposed to prevent this call?** (Trader auth, state check, etc.)
3. **Is there a missing guard condition?** (Check trader has accepted before calling?)
4. **Is there a frontend auto-submit somewhere?** (RequestDetail.jsx, ConfirmPayoutModal.jsx, etc.)

---

**Last Updated:** May 8, 2026  
**Commit:** 2df4f3ad (Frontend workaround deployed)
