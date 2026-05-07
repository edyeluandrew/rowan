# State Bounce-Back Bug Analysis

## Root Cause Hypothesis

The issue is likely one of these:

### Hypothesis 1: Frontend Using Wrong ID  
- Frontend creates quote → gets `quoteId`
- User sends XLM → Transaction is created with `transactionId` 
- Frontend SHOULD poll `/cashout/status/:transactionId`
- **But if frontend polls `/cashout/status/:quoteId` instead...**
  - The endpoint tries to find by transaction ID (fails)
  - Then tries to find by quote_id
  - It FINDS the transaction but the transaction was just created (state = ESCROW_LOCKED or TRADER_MATCHED)
  - This works fine...

**So this hypothesis doesn't fully explain it.**

---

### Hypothesis 2: Multiple Quotes/Transactions for Same User
- User creates Quote #1
- Sends XLM → Transaction #1 created, reaches TRADER_MATCHED  
- **User creates Quote #2 (without fully completing #1)**
- User's frontend shows Quote #2 info (state = QUOTE_CONFIRMED)
- When trader accepts Transaction #1, user queries status for Quote #2
- `/cashout/status/:quoteId` returns transaction status for Quote #2
- But Quote #2 might not have a transaction yet, so it fails or returns old data

---

### Hypothesis 3: Decline Loop
Looking at the `VALID_TRANSITIONS`:
```
TRADER_MATCHED: ['FIAT_PAYOUT_SUBMITTED', 'ESCROW_LOCKED', 'FAILED', 'REFUNDED']
                  ↑                        ↑ THIS!
```

TRADER_MATCHED can transition BACK to ESCROW_LOCKED for decline/re-matching!

**Scenario:**
1. Transaction reaches TRADER_MATCHED
2. Trader gets matched, clicks accept
3. acceptRequest is called
4. **BUT what if there's an error and decline is called instead?**
5. Decline transitions: TRADER_MATCHED → ESCROW_LOCKED
6. Then re-matching runs: ESCROW_LOCKED → TRADER_MATCHED again
7. **But if frontend is polling the wrong endpoint, it might see stale data**

---

## Actual Fix Needed

### Frontend Side (in user portal)
When polling transaction status, **ALWAYS use transactionId, not quoteId**:

```javascript
// CORRECT ✅
GET /api/v1/cashout/status/:transactionId

// WRONG ❌  
GET /api/v1/cashout/status/:quoteId
```

After confirming deposit (`POST /cashout/confirm`), the response includes `transactionId`. Use THAT for all status polling.

---

### Backend Side (preventive)
Add validation in `/cashout/status` to prevent confusion:

```javascript
// Log which ID type was used
if (id matches quote_id pattern) {
  logger.warn(`[Security] Status endpoint called with quoteId instead of transactionId`);
}
```

---

## Verification Steps

### For User (Right Now)
1. Create a quote and note the `quoteId`
2. Send XLM to escrow
3. After Horizon confirms, check your transaction
4. **Save the `transactionId` from the response**
5. Use that `transactionId` for ALL subsequent `/cashout/status` calls
6. Do NOT poll `/cashout/status` with the `quoteId`

---

### For Developer (Code Check)
In frontend code, search for:
```javascript
/cashout/status  // Find all calls
```

Then verify each is using `transactionId` and not `quoteId`:
```javascript
// GOOD ✅
const response = await fetch(`/api/v1/cashout/status/${transaction.id}`);

// BAD ❌
const response = await fetch(`/api/v1/cashout/status/${quote.id}`);
```

---

## Why This Would Cause "Bounce-Back"

If frontend polls with `quoteId`:
1. First poll after XLM sent: finds transaction in ESCROW_LOCKED → shows ESCROW_LOCKED ✅
2. After Horizon swap/match: finds transaction in TRADER_MATCHED → shows TRADER_MATCHED ✅
3. **User creates NEW quote** (tests again)
4. Frontend still polling old quoteId? 
   - Or frontend confused about which quote/tx is active?
   - Shows QUOTE_CONFIRMED (quote state) instead of transaction state ❌

---

## Quick Debug: Which endpoint is being called?

Open browser DevTools → Network tab:
1. Create quote
2. Send XLM
3. After confirmed, check Network tab
4. Look for `/cashout/status` calls
5. **Check the `:id` parameter**
   - Is it 36 chars (UUID) that matches the quoteId? 
   - Or is it the transactionId?

If it's quoteId, that's the bug!

---

## Recommended Fix

### Backend: Make Status Endpoint Warn About quoteId Usage
Edit `/backend/src/routes/cashout.js` status endpoint:

```javascript
router.get('/status/:id', async (req, res, next) => {
  const id = req.params.id;
  
  // NEW: Check if this looks like it's being used as a quoteId
  // Queries by transactionId first should be the default pattern
  
  logger.info(`[Cashout] status query for ${id}`);
  // ... rest of endpoint ...
});
```

### Frontend: Ensure Using transactionId  

After `POST /cashout/confirm` response, extract `transactionId`:

```javascript
const confirmResponse = await fetch('/api/v1/cashout/confirm', {
  method: 'POST',
  body: JSON.stringify({
    quoteId: quote.id,  // OK to send quoteId to confirm
    stellarTxHash: txHash
  })
});

const { transactionId } = await confirmResponse.json();

// Now ALL subsequent status calls use transactionId:
setInterval(async () => {
  const status = await fetch(`/api/v1/cashout/status/${transactionId}`);
  // display status...
}, 2000);
```

---

## Test Scenario to Validate

1. Create quote → note `quoteId` = "550e8400-e29b-41d4-..."
2. Send XLM
3. After confirmed, check response for `transactionId` = "aaaaaaaa-bbbb-cccc-..."
4. Poll `/cashout/status/{transactionId}` → should show TRADER_MATCHED ✅
5. Poll `/cashout/status/{quoteId}` → might show confusing data ⚠️
6. Create a NEW quote → note `newQuoteId`
7. Poll `/cashout/status/{newQuoteId}` → should show no transaction (404 or error) ✅

If step 5 or 7 doesn't match expectations, frontend needs fix.
