# Critical Bugs Found - Quick Reference

**Status:** PARTIAL IMPLEMENTATION WITH CRITICAL BUGS  
**Severity:** 4 CRITICAL, 1 MEDIUM, 1 LOW  
**Impact:** Dispute filing, admin queries, and frontend display will fail

---

## CRITICAL BUG #1: Active Trader Load Counting Wrong
**Location:** [backend/src/services/matchingEngine.js](backend/src/services/matchingEngine.js#L92)  
**Line:** 92

**Current Code:**
```javascript
(SELECT COUNT(*) FROM transactions tx
 WHERE tx.trader_id = t.id AND tx.state IN ('TRADER_MATCHED','FIAT_SENT')) as active_load
```

**Problem:** `FIAT_SENT` is not a valid state in the state machine. Transactions bypass this state entirely—they go from `TRADER_MATCHED` → `FIAT_PAYOUT_SUBMITTED` → `USER_CONFIRMATION_PENDING` → `COMPLETE`.

**Impact:** Trader load will be undercounted, potentially allowing traders to overcommit USDC.

**Fix:**
```javascript
(SELECT COUNT(*) FROM transactions tx
 WHERE tx.trader_id = t.id AND tx.state IN ('TRADER_MATCHED','FIAT_PAYOUT_SUBMITTED','USER_CONFIRMATION_PENDING')) as active_load
```

---

## CRITICAL BUG #2: Dead Code - confirmPayout() Transitions to Invalid State
**Location:** [backend/src/services/matchingEngine.js](backend/src/services/matchingEngine.js#L323-L349)  
**Lines:** 323-349

**Current Code:**
```javascript
async function confirmPayout(transactionId, traderId) {
  // ... authorization checks ...
  const transaction = await stateMachine.transition(transactionId, 'TRADER_MATCHED', 'FIAT_SENT');
  // ... notifications ...
  return transaction;
}
```

**Problem:** This function attempts to transition to `FIAT_SENT`, which is NOT in `VALID_TRANSITIONS`. Will throw error:
```
Invalid state transition: TRADER_MATCHED → FIAT_SENT
```

Worse: This function is **dead code**. The actual endpoint uses `submitPayoutSent()` instead:
- [backend/src/routes/trader.js](backend/src/routes/trader.js#L280) calls `submitPayoutSent()`, not `confirmPayout()`

**Impact:** Function will crash if ever called. Currently not used but represents dangerous dead code.

**Fix:** Either delete the function or update it to use correct state:
```javascript
async function confirmPayout(transactionId, traderId) {
  // ... authorization checks ...
  const transaction = await stateMachine.transition(transactionId, 'TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED', { payout_reference });
  // ... notifications ...
  return transaction;
}
```

**Better Fix:** Delete this function entirely. Use `submitPayoutSent()` instead.

---

## CRITICAL BUG #3: Dispute Endpoint Checks Non-Existent State
**Location:** [backend/src/routes/cashout.js](backend/src/routes/cashout.js#L420)  
**Lines:** 391-430

**Current Code:**
```javascript
const txResult = await db.query(
  `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND state = 'FIAT_SENT'`,
  [transactionId, req.userId]
);
const tx = txResult.rows[0];
if (!tx) {
  return res.status(404).json({ error: 'Transaction not found or not in disputable state' });
}
```

**Problem:** No transaction will ever be in state `FIAT_SENT`. The query will always return empty, and users **cannot file disputes** via this endpoint. 

User dispute is broken: `POST /api/v1/cashout/dispute` will always fail with 404.

**Note:** There's a CORRECT user dispute endpoint at [backend/src/routes/user.js](backend/src/routes/user.js#L897-L900) that uses the right states. This cashout endpoint is redundant and broken.

**Impact:** Users cannot dispute via this endpoint (if it's used). Fortunately, the correct endpoint exists in user.js.

**Fix:**
```javascript
const txResult = await db.query(
  `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND state IN ('FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING')`,
  [transactionId, req.userId]
);
```

**Better Fix:** Delete this endpoint and only use [backend/src/routes/user.js](backend/src/routes/user.js) POST `/transactions/:id/dispute`.

---

## CRITICAL BUG #4: Orphan Transaction Detection Broken
**Location:** [backend/src/services/jobQueue.js](backend/src/services/jobQueue.js#L226-L237)  
**Lines:** 226-237

**Current Code:**
```javascript
// 1. FIAT_SENT for too long → flag for admin (potential dispute)
const stuckTransactions = await db.query(
  `SELECT id, trader_id, user_id, state, trader_matched_at FROM transactions
   WHERE t.state = 'FIAT_SENT'
   AND t.fiat_sent_at < NOW() - INTERVAL '1 minute' * $1`,
  [config.platform.orphanFiatSentMinutes || 60]
);
```

**Problem:** Query searches for `FIAT_SENT` state which doesn't exist. Will never find stuck transactions.

**Impact:** Admin will not be notified of transactions stuck in `FIAT_PAYOUT_SUBMITTED` state (i.e., trader sent payment but user hasn't confirmed). Could cause losses if not detected.

**Fix:**
```javascript
// 1. FIAT_PAYOUT_SUBMITTED for too long → flag for admin (potential dispute)
const stuckTransactions = await db.query(
  `SELECT id, trader_id, user_id, state, trader_matched_at FROM transactions
   WHERE t.state = 'FIAT_PAYOUT_SUBMITTED'
   AND t.fiat_payout_submitted_at < NOW() - INTERVAL '1 minute' * $1`,
  [config.platform.orphanFiatSentMinutes || 60]
);
```

---

## CRITICAL BUG #5: Admin Dashboard Queries Wrong
**Location:** [backend/src/services/adminRealTimeService.js](backend/src/services/adminRealTimeService.js#L37)  
**Lines:** 35-40 and 103-104

**Current Code:**
```javascript
// Line 35-40
SELECT COALESCE(SUM(usdc_amount), 0) as escrow_locked
FROM transactions
WHERE state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_SENT')

// Line 103-104
COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'FIAT_SENT'), 0) as pending_confirmation,
COUNT(*) FILTER (WHERE state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_SENT')) as active_transactions
```

**Problem:** `FIAT_SENT` doesn't exist. Admin dashboard will miss transactions in `FIAT_PAYOUT_SUBMITTED` and `USER_CONFIRMATION_PENDING` states.

**Impact:** Admin sees incorrect escrow balances and transaction counts.

**Fix:**
```javascript
// Correct query
WHERE state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING')

// And for pending confirmation
FILTER (WHERE state IN ('FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING'))
```

---

## MEDIUM BUG #6: Frontend State Definitions Missing
**Location:** [frontend/src/utils/constants.js](frontend/src/utils/constants.js#L26)  
**Lines:** 24-32

**Current Code:**
```javascript
export const TX_STATES = {
  PENDING_ESCROW:   { label: 'Pending Escrow',  badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  ESCROW_FUNDED:    { label: 'Escrow Funded',    badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  TRADER_MATCHED:   { label: 'Matched',          badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  FIAT_SENT:        { label: 'Fiat Sent',        badge: 'bg-blue-500/15 text-blue-400' },
  COMPLETE:         { label: 'Complete',          badge: 'bg-rowan-green/15 text-rowan-green' },
  REFUNDED:         { label: 'Refunded',          badge: 'bg-rowan-muted/15 text-rowan-muted' },
  DISPUTED:         { label: 'Disputed',          badge: 'bg-rowan-red/15 text-rowan-red' },
  FAILED:           { label: 'Failed',            badge: 'bg-rowan-red/15 text-rowan-red' },
};
```

**Problems:**
1. `FIAT_SENT` definition exists but state doesn't exist in backend
2. Missing definitions for:
   - `FIAT_PAYOUT_SUBMITTED`
   - `USER_CONFIRMATION_PENDING`
   - `RELEASE_BLOCKED` (shown when USDC release fails)
   - `DISPUTE_OPENED`

**Impact:** Frontend cannot display transactions in new states. UI will be blank or error for ~40% of cashout flow.

**Usage:** [frontend/src/pages/Home.jsx](frontend/src/pages/Home.jsx#L37)
```javascript
r.state === 'TRADER_MATCHED' || r.state === 'FIAT_SENT'
```

This check is incomplete.

**Fix:**
```javascript
export const TX_STATES = {
  PENDING_ESCROW:         { label: 'Pending Escrow',  badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  ESCROW_FUNDED:          { label: 'Escrow Funded',    badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  ESCROW_LOCKED:          { label: 'Locked in Escrow', badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  TRADER_MATCHED:         { label: 'Matched',          badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  FIAT_PAYOUT_SUBMITTED:  { label: 'Payment Sent',     badge: 'bg-blue-500/15 text-blue-400' },
  USER_CONFIRMATION_PENDING: { label: 'Confirming Receipt', badge: 'bg-blue-500/15 text-blue-400' },
  COMPLETE:               { label: 'Complete',        badge: 'bg-rowan-green/15 text-rowan-green' },
  REFUNDED:               { label: 'Refunded',        badge: 'bg-rowan-muted/15 text-rowan-muted' },
  DISPUTED:               { label: 'Disputed',        badge: 'bg-rowan-red/15 text-rowan-red' },
  DISPUTE_OPENED:         { label: 'Dispute Open',    badge: 'bg-rowan-red/15 text-rowan-red' },
  RELEASE_BLOCKED:        { label: 'Release Failed',  badge: 'bg-rowan-red/15 text-rowan-red' },
  FAILED:                 { label: 'Failed',          badge: 'bg-rowan-red/15 text-rowan-red' },
};
```

---

## MEDIUM BUG #7: Trader Response Returns Wrong State Name
**Location:** [backend/src/routes/trader.js](backend/src/routes/trader.js#L325)  
**Line:** 325

**Current Code:**
```javascript
res.json({
  status: 'FIAT_SENT',
  message: 'Payment submitted. Waiting for customer confirmation before USDC is released.',
  transaction: { ... }
});
```

**Problem:** Response says `'FIAT_SENT'` but actual transaction state is `'FIAT_PAYOUT_SUBMITTED'`.

**Impact:** Trader app will display wrong status. Could confuse traders about transaction state.

**Fix:**
```javascript
res.json({
  status: 'FIAT_PAYOUT_SUBMITTED',
  message: 'Payment submitted. Waiting for customer confirmation before USDC is released.',
  transaction: { ... }
});
```

---

## LOW BUG #8: Unused Timestamp Column
**Location:** [backend/src/services/transactionStateMachine.js](backend/src/services/transactionStateMachine.js#L35-L45)  
**Lines:** 39

**Current Code:**
```javascript
const STATE_TIMESTAMPS = {
  QUOTE_CONFIRMED:  'quote_confirmed_at',
  ESCROW_LOCKED:    'escrow_locked_at',
  TRADER_MATCHED:   'trader_matched_at',
  FIAT_PAYOUT_SUBMITTED: 'fiat_payout_submitted_at',
  USER_CONFIRMATION_PENDING: 'user_confirmation_pending_at',
  // Missing: FIAT_SENT or fiat_sent_at
  COMPLETE:         'completed_at',
  // ...
};
```

**Problem:** Database has `fiat_sent_at` column, but new state machine doesn't set it. Orphaned column.

**Impact:** Low priority. Doesn't break functionality, but creates confusion. Analytics queries that depend on `fiat_sent_at` will get NULL values.

**Fix (low priority):** Deprecate `fiat_sent_at` column or add migration to remove it after verifying no dashboards depend on it.

---

## Summary Table

| Bug | File | Line | Type | Status | Impact |
|-----|------|------|------|--------|--------|
| Active load counting | matchingEngine.js | 92 | CRITICAL | Not used by trader endpoint? | Trader overcommit possible |
| Dead code confirmPayout | matchingEngine.js | 323-349 | CRITICAL | Not called | Safe but messy |
| Dispute endpoint | cashout.js | 420 | CRITICAL | Redundant endpoint exists | Users can't dispute via this endpoint |
| Orphan detection | jobQueue.js | 226-237 | CRITICAL | No monitoring | Stuck txs not detected |
| Admin queries | adminRealTimeService.js | 37, 103 | CRITICAL | Dashboard affected | Wrong balances shown |
| Frontend states | constants.js | 26 | MEDIUM | UI broken for new states | 40% of flow shows blank |
| Trader response | trader.js | 325 | MEDIUM | API response wrong | Trader confusion |
| Stale column | transactionStateMachine.js | 39 | LOW | Not set anymore | Analytics confusion |

---

## Fix Effort Estimate

- **Active load query:** 2 min — single line update
- **Dead code:** 2 min — delete function
- **Dispute endpoint:** 3 min — update WHERE clause or delete endpoint
- **Orphan detection:** 3 min — replace state names
- **Admin queries:** 5 min — update two state IN() lists
- **Frontend constants:** 10 min — add missing state definitions
- **Trader response:** 1 min — single string change
- **Stale column:** 15 min — investigate if it's used, then deprecate

**Total: ~40 minutes** to fix all bugs.

---

## Verification After Fixes

Run:
```bash
# Verify no remaining FIAT_SENT references
grep -r "FIAT_SENT" backend/src --include="*.js"
# Should return 0 results (except in comments/documentation)

# Verify all states are defined in frontend
grep -o "'[A-Z_]*'" frontend/src/utils/constants.js | sort | uniq
# Should include all states from backend state machine
```

