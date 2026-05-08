# ROWAN Backend Codebase Analysis

**Date:** May 7, 2026  
**Focus:** Database schema, matching engine, float reservation, state transitions, escrow controller, and float finalization

---

## 1. DATABASE SCHEMA: `trader_payout_settings` Table

**File:** [backend/supabase/migrations/20260506_trader_payout_settings.sql](backend/supabase/migrations/20260506_trader_payout_settings.sql)

### Full Table Definition

```sql
CREATE TABLE IF NOT EXISTS trader_payout_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id         UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  country           TEXT NOT NULL,                    -- e.g., 'Uganda', 'Kenya'
  network           mobile_network NOT NULL,         -- enum: MTN_UG, AIRTEL_UG, M_PESA_KE, etc.
  currency          TEXT NOT NULL,                   -- ISO 4217: UGX, KES, TZS
  min_amount        NUMERIC(18,2) NOT NULL,          -- minimum fiat payout
  max_amount        NUMERIC(18,2) NOT NULL,          -- maximum fiat payout
  available_float   NUMERIC(18,2) NOT NULL,          -- current available fiat for payouts
  reserved_float    NUMERIC(18,2) NOT NULL DEFAULT 0, -- fiat reserved for active requests
  
  -- Optional pricing fields (not yet used in matching)
  rate_per_usdc     NUMERIC(18,7),                   -- fiat per 1 USDC (e.g., 3760 UGX)
  spread_percent    NUMERIC(5,2),                    -- trader margin/spread (0-100%)
  fee_percent       NUMERIC(5,2),                    -- optional fee (0-100%)
  
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_amounts CHECK (max_amount > min_amount AND min_amount >= 0),
  CONSTRAINT chk_float CHECK (available_float >= 0 AND reserved_float >= 0),
  UNIQUE(trader_id, network, currency)
);
```

### Key Fields Present ✅

- ✅ `trader_id` — References traders(id)
- ✅ `country` — Country of operation
- ✅ `network` — Mobile money network (mobile_network enum)
- ✅ `currency` — ISO 4217 currency code (UGX, KES, TZS)
- ✅ `min_amount` — Minimum payout amount
- ✅ `max_amount` — Maximum payout amount
- ✅ `available_float` — Available fiat for payouts
- ✅ `reserved_float` — Fiat reserved for active transactions
- ✅ `rate_per_usdc` — Optional pricing (nullable)
- ✅ `spread_percent` — Optional spread/margin (nullable)
- ✅ `fee_percent` — Optional fee (nullable)
- ✅ `is_active` — Active/inactive status

### Indexes

```sql
CREATE INDEX idx_payout_trader ON trader_payout_settings (trader_id);
CREATE INDEX idx_payout_active ON trader_payout_settings (trader_id, is_active);
CREATE INDEX idx_payout_network ON trader_payout_settings (network, currency, is_active);
```

---

## 2. MATCHING ENGINE

**File:** [backend/src/services/matchingEngine.js](backend/src/services/matchingEngine.js)

### Main Function: `matchTrader(transactionId)`

#### Matching Criteria (in order):

1. **Trader Status**: `status = 'ACTIVE'`
2. **Verification Status**: `verification_status = 'VERIFIED'`
3. **Payout Setting**: `is_active = TRUE` for the network/currency
4. **Network Match**: `ps.network = $1` (matches transaction network)
5. **Currency Match**: `ps.currency = $4` (matches transaction currency)
6. **Amount in Bounds**: `$2 >= ps.min_amount AND $2 <= ps.max_amount`
7. **Available Float Check**: `(ps.available_float - COALESCE(ps.reserved_float, 0)) >= $2`
8. **Daily Limit**: `(t.daily_volume + $3) <= t.daily_limit_ugx`

#### Selection Order
- Highest `trust_score` first
- Lowest current load (active transactions) second

### Database Query (Lines 72-96)

```javascript
const traderResult = await db.query(
  `SELECT t.*,
     ps.id as payout_setting_id,
     ps.min_amount,
     ps.max_amount,
     ps.available_float,
     ps.reserved_float,
     (SELECT COUNT(*) FROM transactions tx
      WHERE tx.trader_id = t.id AND tx.state IN ('TRADER_MATCHED','FIAT_SENT')) as active_load
   FROM traders t
   INNER JOIN trader_payout_settings ps ON ps.trader_id = t.id
   WHERE t.status = 'ACTIVE'
     AND t.verification_status = 'VERIFIED'
     AND ps.is_active = true
     AND ps.network = $1
     AND ps.currency = $4
     AND $2 >= ps.min_amount
     AND $2 <= ps.max_amount
     AND (ps.available_float - COALESCE(ps.reserved_float, 0)) >= $2
     AND (t.daily_volume + $3) <= t.daily_limit_ugx
   ORDER BY t.trust_score DESC, active_load ASC
   LIMIT 1`,
  [transaction.network, fiatAmountUgx, fiatAmountUgx, fiatCurrency]
);
```

### Exported Functions

```javascript
export default {
  setIo,
  matchTrader,
  acceptRequest,
  confirmPayout,
  submitPayoutSent,
};
```

---

## 3. FLOAT RESERVATION LIFECYCLE

**File:** [backend/src/services/payoutSettingsService.js](backend/src/services/payoutSettingsService.js)

### Phase 1: Reserve Float When Trader Matched (Lines 316-360)

```javascript
async reserveFloat(payoutSettingId, fiatAmount) {
  // Atomically reserve: check still available, increment reserved_float
  const result = await db.query(
    `UPDATE trader_payout_settings
     SET reserved_float = reserved_float + $1,
         updated_at = NOW()
     WHERE id = $2
       AND (available_float - reserved_float) >= $1
     RETURNING id, trader_id, network, currency, available_float, reserved_float`,
    [fiatAmount, payoutSettingId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Insufficient available float to reserve');
    err.status = 409;
    throw err;
  }
  // ...
}
```

**Called from:** [matchingEngine.js Line 179](backend/src/services/matchingEngine.js#L179)
```javascript
await payoutSettingsService.reserveFloat(trader.payout_setting_id, fiatNeeded);

// Update transaction with payout_setting_id for lifecycle tracking
await db.query(
  `UPDATE transactions SET payout_setting_id = $1 WHERE id = $2`,
  [trader.payout_setting_id, transactionId]
);
```

### Phase 2: Release Reserved Float on Failure (Lines 362-378)

```javascript
async releaseReservedFloat(payoutSettingId, fiatAmount) {
  // Atomically release: decrement reserved_float, ensure non-negative
  const result = await db.query(
    `UPDATE trader_payout_settings
     SET reserved_float = GREATEST(0, reserved_float - $1),
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, trader_id, network, currency, available_float, reserved_float`,
    [fiatAmount, payoutSettingId]
  );
  // ...
}
```

### Phase 3: Finalize Float on Completion (Lines 380-414)

```javascript
async finalizeFloat(payoutSettingId, fiatAmount) {
  // Atomically finalize: decrement BOTH available AND reserved
  const result = await db.query(
    `UPDATE trader_payout_settings
     SET available_float = GREATEST(0, available_float - $1),
         reserved_float = GREATEST(0, reserved_float - $1),
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, trader_id, network, currency, available_float, reserved_float`,
    [fiatAmount, payoutSettingId]
  );
  // ...
}
```

**Called from:** [escrowController.js Line 571](backend/src/services/escrowController.js#L571)
```javascript
if (transaction.payout_setting_id && transaction.fiat_amount) {
  try {
    await payoutSettingsService.finalizeFloat(
      transaction.payout_setting_id,
      parseFloat(transaction.fiat_amount)
    );
    logger.info(`[Escrow] Finalized float for tx ${transactionId}: ...`);
  } catch (finalizeErr) {
    logger.error(`[Escrow] Failed to finalize float...`);
    // Continue anyway — transaction is already COMPLETE
  }
}
```

---

## 4. TRANSACTION STATE TRANSITIONS

**File:** [backend/src/services/transactionStateMachine.js](backend/src/services/transactionStateMachine.js)

### Complete State Flow

```
QUOTE_REQUESTED 
  → QUOTE_CONFIRMED 
  → ESCROW_LOCKED 
  → TRADER_MATCHED
    → FIAT_PAYOUT_SUBMITTED (trader marks payout sent)
    → USER_CONFIRMATION_PENDING (user confirms receipt)
    → COMPLETE (USDC released to trader)
```

### Valid Transitions Map

```javascript
const VALID_TRANSITIONS = {
  QUOTE_REQUESTED:  ['QUOTE_CONFIRMED', 'FAILED'],
  QUOTE_CONFIRMED:  ['ESCROW_LOCKED', 'FAILED'],
  ESCROW_LOCKED:    ['TRADER_MATCHED', 'FAILED', 'REFUNDED'],
  TRADER_MATCHED:   ['FIAT_PAYOUT_SUBMITTED', 'ESCROW_LOCKED', 'FAILED', 'REFUNDED'],
  FIAT_PAYOUT_SUBMITTED: ['USER_CONFIRMATION_PENDING', 'DISPUTE_OPENED', 'FAILED', 'REFUNDED'],
  USER_CONFIRMATION_PENDING: ['COMPLETE', 'RELEASE_BLOCKED', 'FAILED', 'REFUNDED'],
  RELEASE_BLOCKED:  ['COMPLETE', 'FAILED', 'REFUNDED'],
  FAILED:           ['REFUNDED'],
  COMPLETE:         [], // terminal
  REFUNDED:         [], // terminal
  DISPUTE_OPENED:   ['FAILED', 'REFUNDED'],
};
```

### State Timestamps

```javascript
const STATE_TIMESTAMPS = {
  QUOTE_CONFIRMED:  'quote_confirmed_at',
  ESCROW_LOCKED:    'escrow_locked_at',
  TRADER_MATCHED:   'trader_matched_at',
  FIAT_PAYOUT_SUBMITTED: 'fiat_payout_submitted_at',
  USER_CONFIRMATION_PENDING: 'user_confirmation_pending_at',
  COMPLETE:         'completed_at',
  FAILED:           'failed_at',
  REFUNDED:         'refunded_at',
};
```

### Transition Function

```javascript
async function transition(transactionId, fromState, toState, extra = {}) {
  // 1. Validate the transition
  const allowed = VALID_TRANSITIONS[fromState];
  if (!allowed || !allowed.includes(toState)) {
    throw new Error(`Invalid state transition: ${fromState} → ${toState} for tx ${transactionId}`);
  }

  // 2. Build dynamic SET clause with timestamp
  const sets = ['state = $1'];
  const params = [toState];
  
  // Auto-set timestamp for new state
  const tsCol = STATE_TIMESTAMPS[toState];
  if (tsCol) {
    sets.push(`${tsCol} = NOW()`);
  }
  
  // Apply extra columns (e.g., trader_id, payout_reference)
  for (const [col, val] of Object.entries(extra)) {
    sets.push(`${col} = $${idx}`);
    params.push(val);
    idx++;
  }

  // 3. Update with optimistic lock (WHERE state = fromState)
  const query = `
    UPDATE transactions
    SET ${sets.join(', ')}
    WHERE id = $${idx} AND state = $${idx + 1}
    RETURNING *
  `;
  
  const result = await db.query(query, params);
  return result.rows[0] || null;
}
```

---

## 5. TRADER PAYOUT SUBMISSION & STATE PROGRESSION

**File:** [backend/src/services/matchingEngine.js](backend/src/services/matchingEngine.js) (Lines 356-407)

### `submitPayoutSent(transactionId, traderId, payoutReference)`

```javascript
async function submitPayoutSent(transactionId, traderId, payoutReference) {
  // 1. Verify trader authorization
  const txCheck = await db.query(
    `SELECT id, trader_id, state FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const tx = txCheck.rows[0];
  
  if (tx.state !== 'TRADER_MATCHED') {
    throw new Error(`Cannot submit payout — transaction in state ${tx.state}, expected TRADER_MATCHED`);
  }
  
  if (tx.trader_id !== traderId) {
    throw new Error('Cannot submit payout — transaction not assigned to this trader');
  }

  // 2. Transition: TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED
  const transaction = await stateMachine.transition(
    transactionId,
    'TRADER_MATCHED',
    'FIAT_PAYOUT_SUBMITTED',
    { payout_reference: payoutReference }
  );
  
  if (!transaction) {
    throw new Error('Cannot submit payout — state transition failed (concurrent modification)');
  }

  // 3. Notify user
  notificationService.notifyUser(transaction.user_id, 'trader_sent_payout', {
    transactionId: transaction.id,
    state: 'FIAT_PAYOUT_SUBMITTED',
    fiat_amount: transaction.fiat_amount,
    fiat_currency: transaction.fiat_currency,
    message: 'Trader marked payment as sent. Please confirm receipt.',
  });

  return transaction;
}
```

**Route:** [backend/src/routes/trader.js](backend/src/routes/trader.js) - `POST /api/v1/trader/requests/:id/payout-sent`

---

## 6. USER RECEIPT CONFIRMATION & STATE PROGRESSION

**File:** [backend/src/routes/user.js](backend/src/routes/user.js) (Lines 760-831)

### `POST /api/v1/user/transactions/:id/confirm-receipt`

```javascript
// 1. Fetch transaction (by transaction ID or quote_id)
let transaction = await db.query(
  `SELECT id, user_id, state, trader_id, usdc_amount, fiat_amount, fiat_currency, stellar_release_tx
   FROM transactions WHERE id = $1 AND user_id = $2`,
  [id, userId]
);

// 2. Validate state
if (transaction.state !== 'FIAT_PAYOUT_SUBMITTED' && transaction.state !== 'USER_CONFIRMATION_PENDING') {
  return res.status(400).json({
    error: `Cannot confirm receipt in state ${transaction.state}. Expected FIAT_PAYOUT_SUBMITTED or USER_CONFIRMATION_PENDING.`
  });
}

// 3. Transition: FIAT_PAYOUT_SUBMITTED → USER_CONFIRMATION_PENDING
if (transaction.state === 'FIAT_PAYOUT_SUBMITTED') {
  const confirmResult = await stateMachine.transition(
    id,
    'FIAT_PAYOUT_SUBMITTED',
    'USER_CONFIRMATION_PENDING'
  );
  transaction = confirmResult;
}

// 4. Trigger USDC release to trader
await escrowController.releaseToTrader(transaction.id);
```

---

## 7. ESCROW CONTROLLER: USDC RELEASE LOGIC

**File:** [backend/src/services/escrowController.js](backend/src/services/escrowController.js) (Lines 430-600)

### `releaseToTrader(transactionId)`

#### Guard: Transaction Must Be in USER_CONFIRMATION_PENDING State

```javascript
const txResult = await db.query(
  `SELECT t.*, tr.stellar_address as trader_stellar
   FROM transactions t
   JOIN traders tr ON tr.id = t.trader_id
   WHERE t.id = $1 AND t.state = 'USER_CONFIRMATION_PENDING'`,
  [transactionId]
);
const transaction = txResult.rows[0];
if (!transaction) throw new Error('Transaction not found or wrong state');
```

**Critical:** The function will ONLY release USDC if the transaction is in `USER_CONFIRMATION_PENDING` state. It will NOT release if in `FIAT_PAYOUT_SUBMITTED`.

#### Trustline Check Before Release

```javascript
// ── [H-1 FIX] Check trader has USDC trustline before attempting release ──
const traderAccount = await horizon.loadAccount(transaction.trader_stellar);

const hasTrustline = traderAccount.balances.some(
  (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
);

if (!hasTrustline) {
  logger.error(`[Escrow] Trader ${transaction.trader_id} has no USDC trustline — blocking release`);
  await stateMachine.transition(transactionId, 'USER_CONFIRMATION_PENDING', 'RELEASE_BLOCKED', {
    failure_reason: 'Trader missing USDC trustline',
  });
  return null;
}
```

#### Stellar Payment Operation

```javascript
const tx = new StellarSdk.TransactionBuilder(escrowAccount, {
  fee: config.stellarMaxFee,
  networkPassphrase,
})
  .addOperation(
    StellarSdk.Operation.payment({
      destination: transaction.trader_stellar,
      asset: USDC_ASSET,
      amount: usdcDecimal.toFixed(7),
    })
  )
  .setTimeout(30)
  .build();

tx.sign(escrowKeypair);
const result = await horizon.submitTransaction(tx);
```

#### State Transition to COMPLETE

```javascript
// Update transaction to COMPLETE
await stateMachine.transition(transactionId, 'USER_CONFIRMATION_PENDING', 'COMPLETE', {
  stellar_release_tx: result.hash,
});
```

#### Float Finalization (Both available_float and reserved_float reduced)

```javascript
// ── PHASE 3: Finalize float in payout_settings ──
// Deduct BOTH available_float and reserved_float when transaction completes
if (transaction.payout_setting_id && transaction.fiat_amount) {
  try {
    await payoutSettingsService.finalizeFloat(
      transaction.payout_setting_id,
      parseFloat(transaction.fiat_amount)
    );
    logger.info(`[Escrow] Finalized float for tx ${transactionId}: setting ${transaction.payout_setting_id}, amount ${transaction.fiat_amount}`);
  } catch (finalizeErr) {
    logger.error(`[Escrow] Failed to finalize float for tx ${transactionId}:`, finalizeErr.message);
    // Continue anyway — transaction is already COMPLETE
  }
}
```

#### Daily Volume Update

```javascript
// ── [C-1 FIX] Update trader daily volume in UGX equivalent, not USDC ──
const fiatAmount = parseFloat(transaction.fiat_amount);
const fiatCurrency = transaction.fiat_currency || 'UGX';
const KES_TO_UGX = config.usdcFiatRates.UGX / config.usdcFiatRates.KES;
const TZS_TO_UGX = config.usdcFiatRates.UGX / config.usdcFiatRates.TZS;
const ugxEquivalent = fiatCurrency === 'KES' ? Math.floor(fiatAmount * KES_TO_UGX)
                    : fiatCurrency === 'TZS' ? Math.floor(fiatAmount * TZS_TO_UGX)
                    : Math.floor(fiatAmount);

await db.query(
  `UPDATE traders SET daily_volume = daily_volume + $1 WHERE id = $2`,
  [ugxEquivalent, transaction.trader_id]
);
```

---

## 8. DATABASE MIGRATIONS RELATED TO PAYOUT SETTINGS

### Migration: [backend/supabase/migrations/20260505_add_user_confirmation_states.sql](backend/supabase/migrations/20260505_add_user_confirmation_states.sql)

Adds new states and columns:
- `FIAT_PAYOUT_SUBMITTED` state
- `USER_CONFIRMATION_PENDING` state
- `DISPUTE_OPENED` state
- `fiat_payout_submitted_at` timestamp
- `user_confirmation_pending_at` timestamp
- `payout_reference` TEXT column (for trader's mobile money reference)

### Migration: [backend/supabase/migrations/20260506_add_payout_setting_id_to_transactions.sql](backend/supabase/migrations/20260506_add_payout_setting_id_to_transactions.sql)

```sql
ALTER TABLE transactions
ADD COLUMN payout_setting_id UUID REFERENCES trader_payout_settings(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_payout_setting ON transactions(payout_setting_id);
```

---

## 9. FLOW DIAGRAM: Complete Transaction Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. QUOTE PHASE                                                          │
│    - User requests quote                                                │
│    - State: QUOTE_REQUESTED → QUOTE_CONFIRMED → ESCROW_LOCKED          │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. MATCHING PHASE (matchTrader)                                         │
│    - Find eligible trader:                                              │
│      * status = 'ACTIVE'                                                │
│      * verification_status = 'VERIFIED'                                 │
│      * payout_setting.is_active = TRUE                                  │
│      * network matches                                                  │
│      * currency matches                                                 │
│      * amount within min/max                                            │
│      * available_float >= amount                                        │
│      * daily_limit not exceeded                                         │
│    - State: ESCROW_LOCKED → TRADER_MATCHED                              │
│    - Store payout_setting_id in transaction                             │
│    - Reserve float: reserved_float += amount                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. TRADER ACCEPTANCE                                                    │
│    - Trader reviews and accepts request                                 │
│    - State: TRADER_MATCHED (unchanged, just sets matched_at timestamp)  │
│    - User is notified: "Trader accepted, proceeding to payout"          │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. TRADER PAYOUT SUBMISSION (submitPayoutSent)                          │
│    - Trader sends mobile money to user                                  │
│    - Trader submits payout reference                                    │
│    - State: TRADER_MATCHED → FIAT_PAYOUT_SUBMITTED                      │
│    - User is notified: "Mobile money sent, please confirm receipt"      │
│    - USDC is NOT yet released to trader                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. USER RECEIPT CONFIRMATION (confirm-receipt)                          │
│    - User confirms receipt of mobile money                              │
│    - State: FIAT_PAYOUT_SUBMITTED → USER_CONFIRMATION_PENDING           │
│    - Triggers escrow release to trader                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. ESCROW RELEASE (releaseToTrader)                                     │
│    - GUARD: Must be in USER_CONFIRMATION_PENDING state                  │
│    - Check trader has USDC trustline                                    │
│    - Execute Stellar payment: escrow → trader                           │
│    - State: USER_CONFIRMATION_PENDING → COMPLETE                        │
│    - FINALIZE FLOAT:                                                    │
│      * available_float -= amount                                        │
│      * reserved_float -= amount                                         │
│    - Update trader daily_volume (in UGX)                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. TRANSACTION COMPLETE                                                 │
│    - Both user and trader have received/sent their assets               │
│    - Float is finalized in payout_settings                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. CRITICAL CHECKS & GUARDS

### ✅ Trader Active Status
- **Checked in:** `matchTrader()` query (line 77)
- **Field:** `traders.status = 'ACTIVE'`

### ✅ Trader Verified Status
- **Checked in:** `matchTrader()` query (line 78)
- **Field:** `traders.verification_status = 'VERIFIED'`

### ✅ Payout Setting Exists and Active
- **Checked in:** `matchTrader()` query (line 79)
- **Field:** `trader_payout_settings.is_active = true`
- **Storage:** `payout_setting_id` stored in transaction after match

### ✅ Network Matches
- **Checked in:** `matchTrader()` query (line 80)
- **Field:** `ps.network = transaction.network`

### ✅ Currency Matches
- **Checked in:** `matchTrader()` query (line 81)
- **Field:** `ps.currency = transaction.fiat_currency`

### ✅ Amount Within Min/Max
- **Checked in:** `matchTrader()` query (lines 82-83)
- **Fields:** `$2 >= ps.min_amount AND $2 <= ps.max_amount`

### ✅ Available Float Check
- **Checked in:** `matchTrader()` query (line 84)
- **Formula:** `(ps.available_float - COALESCE(ps.reserved_float, 0)) >= $2`

### ✅ State Guards

**USDC Release Guard:**
- **Requirement:** Transaction MUST be in `USER_CONFIRMATION_PENDING` state
- **Checked in:** `escrowController.releaseToTrader()` (line 459)
- **Query:** `WHERE t.state = 'USER_CONFIRMATION_PENDING'`
- **NOT:** Will not release if in `FIAT_PAYOUT_SUBMITTED`

**Trustline Verification:**
- **Requirement:** Trader must have USDC trustline
- **Checked in:** `escrowController.releaseToTrader()` (lines 469-502)
- **Action if missing:** Transition to `RELEASE_BLOCKED` state

---

## 11. FILE STRUCTURE SUMMARY

```
backend/
├── src/
│   ├── db/
│   │   └── migrations/           # SQL migrations (001-020)
│   │       └── (initial schema defined here)
│   ├── services/
│   │   ├── matchingEngine.js     # ✅ Trader matching logic
│   │   ├── escrowController.js   # ✅ USDC release + float finalization
│   │   ├── payoutSettingsService.js # ✅ Float management (reserve/release/finalize)
│   │   ├── transactionStateMachine.js # ✅ State transitions
│   │   └── [other services...]
│   └── routes/
│       ├── trader.js             # POST /trader/requests/:id/payout-sent
│       ├── user.js               # POST /user/transactions/:id/confirm-receipt
│       └── payoutSettings.js      # Payout settings CRUD
└── supabase/
    └── migrations/               # ✅ Supabase-specific migrations
        ├── 20260505_add_user_confirmation_states.sql
        ├── 20260506_trader_payout_settings.sql
        ├── 20260506_add_payout_setting_id_to_transactions.sql
        └── [others...]
```

---

## 12. SUMMARY OF KEY IMPLEMENTATIONS

| Aspect | Status | Location | Notes |
|--------|--------|----------|-------|
| Trader Active Status Check | ✅ | matchingEngine.js:77 | WHERE t.status = 'ACTIVE' |
| Trader Verified Status Check | ✅ | matchingEngine.js:78 | WHERE t.verification_status = 'VERIFIED' |
| Payout Setting Exists & Active | ✅ | matchingEngine.js:79 | INNER JOIN, WHERE ps.is_active = true |
| Network Matching | ✅ | matchingEngine.js:80 | WHERE ps.network = $1 |
| Currency Matching | ✅ | matchingEngine.js:81 | WHERE ps.currency = $4 |
| Amount Min/Max Check | ✅ | matchingEngine.js:82-83 | WHERE $2 >= min AND $2 <= max |
| Available Float Check | ✅ | matchingEngine.js:84 | WHERE (available - reserved) >= amount |
| Float Reservation | ✅ | payoutSettingsService.js:320 | UPDATE reserved_float += amount |
| payout_setting_id Storage | ✅ | matchingEngine.js:185 | UPDATE transactions SET payout_setting_id |
| State Transition Logic | ✅ | transactionStateMachine.js | All transitions validated |
| FIAT_PAYOUT_SUBMITTED State | ✅ | matchingEngine.js:382 | After trader submits payout reference |
| USER_CONFIRMATION_PENDING State | ✅ | user.js:794 | After user confirms receipt |
| Escrow Release Guard | ✅ | escrowController.js:459 | WHERE t.state = 'USER_CONFIRMATION_PENDING' |
| Float Finalization | ✅ | escrowController.js:571 | BOTH available_float and reserved_float reduced |

