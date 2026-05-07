# Cashout Status ID Bug Analysis

## Summary
**BUG FOUND**: The frontend calls `/cashout/status` with **quoteId** instead of **transactionId** after deposit confirmation.

While the backend is flexible enough to accept either ID, this is an architectural issue and potential bug because:
1. The `confirmQuote` API returns the `transactionId`
2. The frontend code explicitly logs this response but **does not extract/save the transactionId**
3. Navigation uses `quoteId` instead of the returned `transactionId`

---

## File Paths Containing `/cashout/status` Calls

### 1. **rowan-mobile/src/wallet/api/cashout.js** (Line 26)
```javascript
export function getTransactionStatus(transactionId) {
  return client.get(`/api/v1/cashout/status/${transactionId}`).then(res => res.data)
}
```
**ID Parameter**: Named `transactionId` (correct parameter name)

---

## Detailed Call Chain - The Bug

### Step 1: CashoutSend.jsx - Lines 70-83
**File**: [rowan-mobile/src/wallet/pages/CashoutSend.jsx](rowan-mobile/src/wallet/pages/CashoutSend.jsx#L70-L83)

```javascript
// Line 67-73: Calling confirmQuote
console.log('[CashoutSend] 🔗 Confirming quote on backend...', { quoteId: quote.quoteId, stellarTxHash })
try {
  const response = await confirmQuote({
    quoteId: quote.quoteId,
    stellarTxHash,
  })
  console.log('[CashoutSend] ✅ confirmQuote response:', response)
} catch (confirmErr) {
  console.warn('[CashoutSend] ⚠️ Confirm quote error (continuing anyway):', confirmErr.message)
}

// Line 80-83: BUG - Uses quoteId instead of transactionId from response
console.log('[CashoutSend] 🚀 Navigating to transaction status page for quoteId:', quote.quoteId)
navigate(`/wallet/transaction/${quote.quoteId}`, { 
  state: { quoteId: quote.quoteId, stellarTxHash },
  replace: true 
})
```

**🐛 BUG**: The `response` from `confirmQuote` is logged but **never used**. The `transactionId` is not extracted.

---

### Step 2: Backend - confirmQuote Response
**File**: [backend/src/routes/cashout.js](backend/src/routes/cashout.js#L117-L176)

The `/api/v1/cashout/confirm` endpoint returns:
```javascript
// Line 170-176
return res.json({
  status: 'PENDING_DEPOSIT',
  message: 'Transaction already confirmed. Waiting for escrow lock and trader match.',
  quoteId: quote.id,
  transactionId: transactionId,  // <-- This is returned but frontend ignores it!
  stellarTxHash,
});
```

**Response includes**: `transactionId` (UUID), but frontend discards it.

---

### Step 3: TransactionStatus.jsx - Using the Wrong ID
**File**: [rowan-mobile/src/wallet/pages/TransactionStatus.jsx](rowan-mobile/src/wallet/pages/TransactionStatus.jsx#L14-L49)

```javascript
// Line 14: Receives from URL params
const { id } = useParams()  // Contains quoteId, not transactionId

// Line 49: Passes to API
const tx = await getTransactionStatus(id)  // Passes quoteId, expects transactionId parameter
```

---

### Step 4: Backend - Status Endpoint Accepts Both
**File**: [backend/src/routes/cashout.js](backend/src/routes/cashout.js#L200-L235)

```javascript
router.get('/status/:id', async (req, res, next) => {
  const id = req.params.id;
  
  if (userId) {
    // Try by transaction ID first
    result = await db.query(
      `SELECT ... FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    // If not found, fallback to quote_id search
    if (result.rows.length === 0) {
      result = await db.query(
        `SELECT ... FROM transactions WHERE quote_id = $1 AND user_id = $2`,
        [id, userId]
      );
    }
  }
  // ...
});
```

**Why it "works"**: Backend is flexible - tries transaction ID first, then falls back to quote_id search.

---

## Other Files Using getTransactionStatus

### TransactionDetail.jsx - Line 23
**File**: [rowan-mobile/src/wallet/pages/TransactionDetail.jsx](rowan-mobile/src/wallet/pages/TransactionDetail.jsx#L23)

```javascript
const data = await getTransactionStatus(id)
```

Same pattern - receives `id` from URL params and passes it to `getTransactionStatus()`.

---

## Summary of IDs Being Used

| Component | ID Type | Issue |
|-----------|---------|-------|
| **CashoutSend.jsx** | Uses `quote.quoteId` | ❌ Should use `transactionId` from confirmQuote response |
| **confirmQuote() returns** | `transactionId` | ✅ Available but frontend doesn't extract it |
| **TransactionStatus.jsx** | Receives `quoteId` from URL | ⚠️ Should receive `transactionId` |
| **TransactionDetail.jsx** | Receives whatever is in URL | ⚠️ Should be `transactionId` |
| **getTransactionStatus()** | Parameter named `transactionId` | ✅ Correct naming, but receives `quoteId` in practice |
| **Backend /status/:id** | Accepts both IDs | ⚠️ Mask for the frontend bug - should only accept `transactionId` |

---

## The Bug in Plain English

1. **CashoutSend.jsx broadcasts the Stellar transaction** ✅
2. **CashoutSend.jsx calls confirmQuote() API** ✅
3. **Backend returns transactionId in response** ✅
4. **Frontend logs the response** ✅
5. **❌ BUG: Frontend does NOT extract transactionId from response**
6. **❌ BUG: Frontend navigates using quoteId instead**
7. **TransactionStatus receives quoteId from URL** ❌
8. **TransactionStatus passes quoteId to getTransactionStatus()** ❌
9. **Backend has to fallback to quote_id lookup** ⚠️ Masks the bug

---

## Why This Is a Problem

1. **Architectural**: Frontend should use the ID the backend returns
2. **Performance**: Backend queries `transactions` by ID first, then by `quote_id` (extra query)
3. **Security**: Reveals the system accepts lookup by quoteId (easier to enumerate transactions)
4. **Future-proofing**: If backend removes the quote_id fallback, frontend breaks
5. **Race condition**: If transaction hasn't been created yet but quote exists, status returns old quote data
6. **Semantic correctness**: The parameter is named `transactionId` but receives `quoteId`

---

## Fix Required

**In CashoutSend.jsx (Line 70-83)**:

Replace:
```javascript
try {
  const response = await confirmQuote({
    quoteId: quote.quoteId,
    stellarTxHash,
  })
  console.log('[CashoutSend] ✅ confirmQuote response:', response)
} catch (confirmErr) {
  console.warn('[CashoutSend] ⚠️ Confirm quote error (continuing anyway):', confirmErr.message)
}

console.log('[CashoutSend] 🚀 Navigating to transaction status page for quoteId:', quote.quoteId)
navigate(`/wallet/transaction/${quote.quoteId}`, { 
  state: { quoteId: quote.quoteId, stellarTxHash },
  replace: true 
})
```

With:
```javascript
let transactionId = null;
try {
  const response = await confirmQuote({
    quoteId: quote.quoteId,
    stellarTxHash,
  })
  console.log('[CashoutSend] ✅ confirmQuote response:', response)
  transactionId = response?.transactionId; // EXTRACT transactionId
  if (!transactionId) {
    console.warn('[CashoutSend] ⚠️ confirmQuote did not return transactionId, using quoteId as fallback')
    transactionId = quote.quoteId;
  }
} catch (confirmErr) {
  console.warn('[CashoutSend] ⚠️ Confirm quote error (continuing anyway):', confirmErr.message)
  // Fallback to quoteId if confirmQuote fails
  transactionId = quote.quoteId;
}

console.log('[CashoutSend] 🚀 Navigating to transaction status page for transactionId:', transactionId)
navigate(`/wallet/transaction/${transactionId}`, { 
  state: { quoteId: quote.quoteId, transactionId, stellarTxHash },
  replace: true 
})
```

---

## Verification

All calls to `/cashout/status` flow through:
- `rowan-mobile/src/wallet/api/cashout.js:26` - the `getTransactionStatus()` function
- Called from: `TransactionStatus.jsx` and `TransactionDetail.jsx`
- Both receive ID from URL params set by `CashoutSend.jsx`

**Scope**: Only **rowan-mobile** uses this. No calls found in `frontend/src/` (frontend appears to be separate admin/dashboard).
