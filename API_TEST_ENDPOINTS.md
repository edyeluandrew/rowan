# Phase 3 Test - API Testing Endpoints

**Quick reference for testing via curl/Postman**

---

## 🔑 Authentication Tokens

```bash
# Create test user and get token
# First, sign up or log in to get USER_TOKEN

# Get trader token
curl -X POST http://localhost:3000/api/v1/trader/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@test.com",
    "password": "password123"
  }' | jq .token

# Export for use in other requests
export USER_TOKEN="eyJhbGc..."
export TRADER_TOKEN="eyJhbGc..."
export ADMIN_TOKEN="eyJhbGc..."
```

---

## 📋 Complete Test Flow with curl

### Step 1: Get Quote

```bash
curl -X POST http://localhost:3000/api/v1/cashout/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "xlmAmount": 10,
    "network": "M-PESA",
    "phoneHash": "sha256hash_of_phone_number",
    "payoutPhone": "+254700000001"
  }' | jq .

# Save these from response:
export QUOTE_ID="uuid-from-response"
export MEMO="memo-from-response"
export ESCROW_ADDRESS="G-from-response"
export XLM_AMOUNT="10"
```

**Expected Response:**
```json
{
  "quoteId": "550e8400-e29b-41d4-a716-446655440000",
  "memo": "ROWAN-550e8400",
  "escrowAddress": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "xlmAmount": 10,
  "userRate": 50.25,
  "fiatAmount": 502.50,
  "fiatCurrency": "KES",
  "platformFee": 25.00,
  "expiresAt": "2026-05-07T12:15:00Z"
}
```

---

### Step 2: Confirm Deposit (After sending XLM)

```bash
curl -X POST http://localhost:3000/api/v1/cashout/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "quoteId": "'$QUOTE_ID'",
    "stellarTxHash": "stellar-transaction-hash-here"
  }' | jq .

# Save transaction ID from response
export TX_ID="transaction-id-from-response"
```

**Expected Response:**
```json
{
  "transactionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "state": "ESCROW_LOCKED",
  "message": "Deposit confirmed. Waiting for trader assignment."
}
```

---

### Step 3: Check Transaction Status

```bash
# Poll to see transaction progressing through states
curl http://localhost:3000/api/v1/cashout/status/$TX_ID \
  -H "Authorization: Bearer $USER_TOKEN" | jq .

# Keep polling until state = TRADER_MATCHED
# This indicates trader has been matched
```

**Stages:**
```
ESCROW_LOCKED 
  → (5-10 sec) 
TRADER_MATCHED 
  → (when trader accepts)
```

---

### Step 4: Trader Gets Requests

```bash
# As trader, fetch list of matched requests
curl http://localhost:3000/api/v1/trader/requests \
  -H "Authorization: Bearer $TRADER_TOKEN" | jq .

# Save request ID from response
export REQUEST_ID="from-response"
```

**Expected Response:**
```json
[
  {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "xlm_amount": 10,
    "usdc_amount": 10.5,
    "fiat_amount": 502.50,
    "fiat_currency": "KES",
    "network": "M-PESA",
    "state": "TRADER_MATCHED",
    "payout_phone": "+254700000001"
  }
]
```

---

### Step 5: Trader Accepts Request

```bash
curl -X POST http://localhost:3000/api/v1/trader/requests/$REQUEST_ID/accept \
  -H "Authorization: Bearer $TRADER_TOKEN"
```

**Expected Response:**
```json
{
  "status": "accepted",
  "message": "Request accepted. You have 3 minutes to mark payment sent."
}
```

---

### Step 6: Trader Marks Payment Sent

```bash
curl -X POST http://localhost:3000/api/v1/trader/requests/$REQUEST_ID/payout-sent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TRADER_TOKEN" \
  -d '{
    "reference": "TEST123456789"
  }' | jq .
```

**Expected Response:**
```json
{
  "status": "FIAT_PAYOUT_SUBMITTED",
  "message": "Payment submitted. Waiting for customer confirmation before USDC is released.",
  "transaction": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "state": "FIAT_PAYOUT_SUBMITTED",
    "payout_reference": "TEST123456789"
  }
}
```

**Key Point:** State is now `FIAT_PAYOUT_SUBMITTED`

---

### Step 7: User Confirms Receipt ⭐ **THE CRITICAL TEST**

```bash
curl -X POST http://localhost:3000/api/v1/user/transactions/$TX_ID/confirm-receipt \
  -H "Authorization: Bearer $USER_TOKEN" | jq .
```

**Expected Response (Phase 3 Fix Working):**
```json
{
  "status": "COMPLETE",
  "message": "Receipt confirmed. USDC has been released to the trader.",
  "stellarReleaseTx": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "transactionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**If NOT Fixed (Old Behavior):**
```json
{
  "error": "Release failed",
  "details": "Transaction not found or wrong state",
  "message": "USDC release encountered an error. Please contact support."
}
```

---

### Step 8: Verify Transaction Complete

```bash
curl http://localhost:3000/api/v1/user/transactions/$TX_ID \
  -H "Authorization: Bearer $USER_TOKEN" | jq '.state, .stellar_release_tx, .completed_at'

# Should show:
# "state": "COMPLETE"
# "stellar_release_tx": "aaaa..."
# "completed_at": "2026-05-07T12:10:45Z"
```

---

## 🔍 Verification Queries

### Check Transaction States Through Flow

```bash
# Get all transactions for user
curl http://localhost:3000/api/v1/user/transactions \
  -H "Authorization: Bearer $USER_TOKEN" | jq '.[] | {id, state, created_at, completed_at}'

# Get transaction by ID
curl http://localhost:3000/api/v1/user/transactions/$TX_ID \
  -H "Authorization: Bearer $USER_TOKEN" | jq .

# Get trader requests
curl http://localhost:3000/api/v1/trader/requests \
  -H "Authorization: Bearer $TRADER_TOKEN" | jq '.[] | {id, state, fiat_amount}'

# Get trader's payout settings
curl http://localhost:3000/api/v1/trader/payout-settings \
  -H "Authorization: Bearer $TRADER_TOKEN" | jq '.[] | {id, available_float, reserved_float}'
```

---

## 🔧 Admin Endpoints (Monitoring)

```bash
# Get all transactions (admin)
curl http://localhost:3000/api/v1/admin/transactions \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[] | {id, state, trader_id, user_id}'

# Get specific transaction details
curl http://localhost:3000/api/v1/admin/transactions/$TX_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Get escrow transactions
curl http://localhost:3000/api/v1/admin/escrow/transactions \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[] | {id, state, stellar_release_tx}'

# Get trader details
curl http://localhost:3000/api/v1/admin/traders \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[] | {id, name, trust_score, daily_volume}'
```

---

## 📊 Database Queries (Direct Verification)

```bash
# Connect to database
psql $DATABASE_URL

# View transaction progression
SELECT id, state, trader_id, 
       created_at, trader_matched_at, 
       fiat_payout_submitted_at, user_confirmation_pending_at, 
       completed_at, stellar_release_tx
FROM transactions 
WHERE id = 'transaction-uuid-here'
\x on  -- expanded display for readability
\q    -- quit

# View float accounting
SELECT id, trader_id, available_float, reserved_float, 
       (available_float - reserved_float) as net_available
FROM trader_payout_settings 
WHERE id = 'payout-setting-uuid-here'
\q

# View quote
SELECT id, xlm_amount, fiat_amount, fiat_currency, 
       platform_fee, memo, expires_at, used_at
FROM quotes 
WHERE id = 'quote-uuid-here'
\q
```

---

## 🧪 Full Automated Test Script

Save as `test-cashout-flow.sh`:

```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Phase 3 Cashout Flow Test"
echo "========================="

# 1. Get user token (assumes already logged in)
echo -n "Enter USER_TOKEN (from login): "
read USER_TOKEN

# 2. Get trader token
echo "Getting trader token..."
TRADER_LOGIN=$(curl -s -X POST http://localhost:3000/api/v1/trader/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@test.com",
    "password": "password123"
  }')
TRADER_TOKEN=$(echo $TRADER_LOGIN | jq -r '.token')
echo -e "${GREEN}✓ Trader token: ${TRADER_TOKEN:0:20}...${NC}"

# 3. Get quote
echo "Getting quote..."
QUOTE=$(curl -s -X POST http://localhost:3000/api/v1/cashout/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "xlmAmount": 1,
    "network": "M-PESA",
    "phoneHash": "abc123def456",
    "payoutPhone": "+254700000001"
  }')
QUOTE_ID=$(echo $QUOTE | jq -r '.quoteId')
echo -e "${GREEN}✓ Quote created: $QUOTE_ID${NC}"

echo "⚠️  Manual Step Required: Send XLM to escrow address"
echo "Escrow: $(echo $QUOTE | jq -r '.escrowAddress')"
echo "Memo: $(echo $QUOTE | jq -r '.memo')"
echo ""
echo -n "After sending XLM, enter transaction hash: "
read STELLAR_HASH

# 4. Confirm deposit
echo "Confirming deposit..."
CONFIRM=$(curl -s -X POST http://localhost:3000/api/v1/cashout/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "quoteId": "'$QUOTE_ID'",
    "stellarTxHash": "'$STELLAR_HASH'"
  }')
TX_ID=$(echo $CONFIRM | jq -r '.transactionId')
echo -e "${GREEN}✓ Deposit confirmed: $TX_ID${NC}"

# 5. Wait for trader match
echo "Waiting for trader match (polling)..."
for i in {1..30}; do
  STATUS=$(curl -s http://localhost:3000/api/v1/cashout/status/$TX_ID \
    -H "Authorization: Bearer $USER_TOKEN")
  STATE=$(echo $STATUS | jq -r '.state')
  if [ "$STATE" = "TRADER_MATCHED" ]; then
    echo -e "${GREEN}✓ Trader matched!${NC}"
    break
  fi
  echo "  State: $STATE (attempt $i/30)"
  sleep 2
done

# 6. Trader gets request
echo "Trader fetching requests..."
REQUESTS=$(curl -s http://localhost:3000/api/v1/trader/requests \
  -H "Authorization: Bearer $TRADER_TOKEN")
REQUEST_ID=$(echo $REQUESTS | jq -r '.[0].id')
echo -e "${GREEN}✓ Request found: $REQUEST_ID${NC}"

# 7. Trader accepts
echo "Trader accepting..."
curl -s -X POST http://localhost:3000/api/v1/trader/requests/$REQUEST_ID/accept \
  -H "Authorization: Bearer $TRADER_TOKEN" > /dev/null
echo -e "${GREEN}✓ Request accepted${NC}"

# 8. Trader marks sent
echo "Trader marking payment sent..."
curl -s -X POST http://localhost:3000/api/v1/trader/requests/$REQUEST_ID/payout-sent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TRADER_TOKEN" \
  -d '{"reference": "TEST'$(date +%s%N)'"}' > /dev/null
echo -e "${GREEN}✓ Payment marked sent${NC}"

# 9. User confirms receipt
echo "User confirming receipt..."
CONFIRM_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/user/transactions/$TX_ID/confirm-receipt \
  -H "Authorization: Bearer $USER_TOKEN")

# Check for success
if echo $CONFIRM_RESULT | jq -e '.status == "COMPLETE"' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ COMPLETE - USDC Released!${NC}"
  echo -e "${GREEN}✓ Phase 3 Bug Fix VERIFIED${NC}"
  echo "Release TX: $(echo $CONFIRM_RESULT | jq -r '.stellarReleaseTx')"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "Error: $(echo $CONFIRM_RESULT | jq -r '.error')"
  exit 1
fi

echo ""
echo -e "${GREEN}All tests passed!${NC}"
```

Usage:
```bash
chmod +x test-cashout-flow.sh
./test-cashout-flow.sh
```

---

## ✅ Expected Results for Phase 3 Fix

✅ Quote created  
✅ Deposit sent to escrow  
✅ Trader matched  
✅ Trader accepted  
✅ Payment marked sent (state: FIAT_PAYOUT_SUBMITTED)  
✅ **User confirmation returns status: COMPLETE** ← THE FIX  
✅ Stellar release hash obtained  
✅ Transaction reaches COMPLETE state  

If any step fails, check logs and database for state information.
