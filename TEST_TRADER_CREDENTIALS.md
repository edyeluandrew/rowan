# Test Trader Login Credentials

**All credentials are configured in `backend/.env` and set up by running:**
```bash
cd backend
node setup-test-traders-from-env.mjs
```

---

## Quick Copy-Paste

### Trader 1: MTB + Airtel (Most Flexible)
```
Email:    trader-mtb-airtel@test.com
Password: trader123
Methods:  MTB, Airtel
Float:    50,000,000 stroops per network
```

### Trader 2: Airtel Only
```
Email:    trader-airtel@test.com
Password: trader123
Methods:  Airtel
Float:    50,000,000 stroops per network
```

### Trader 3: MTN Only
```
Email:    trader-mtn@test.com
Password: trader123
Methods:  MTN
Float:    50,000,000 stroops per network
```

### Trader 4: Mpesa Only
```
Email:    trader-mpesa@test.com
Password: trader123
Methods:  Mpesa
Float:    50,000,000 stroops per network
```

---

## Configuration

All traders are defined in `backend/.env`:

```env
TEST_TRADERS_CONFIG=\
  trader-mtb-airtel@test.com|trader123|Trader MTB+Airtel|MTB,Airtel|\
  trader-airtel@test.com|trader123|Trader Airtel Only|Airtel|\
  trader-mtn@test.com|trader123|Trader MTN Only|MTN|\
  trader-mpesa@test.com|trader123|Trader Mpesa Only|Mpesa

TEST_TRADERS_FLOAT_PER_NETWORK=50000000
```

**Format:** `email|password|name|methods`  
**Float:** 50,000,000 stroops = 50 XLM equivalent per network

---

## Testing Scenarios

### Scenario 1: Single Trader Accept Flow
1. **Wallet Tab:** Create Airtel quote → Fund escrow
2. **Trader 1 Tab:** See request → Accept → Submit payout
3. **Wallet Tab:** Confirm receipt → Complete

### Scenario 2: Multiple Traders Available
1. **Wallet Tab:** Create Airtel quote → Fund escrow
2. **Trader 1 Tab:** Request appears (MTB+Airtel has it)
3. **Trader 2 Tab:** Request appears (Airtel-only has it)
4. One of them accepts, other should not see it anymore

### Scenario 3: Method-Specific Matching
1. **Wallet Tab:** Create MTN quote → Fund escrow
2. **Trader 3 Tab:** Request appears (MTN-only trader)
3. **Trader 1 Tab:** Request should NOT appear (no MTN method)

---

## Run Setup Script

```bash
cd backend
node setup-diverse-test-traders.mjs
```

Script will output all credentials and payout settings.

---

## Troubleshooting Login

**If login fails:**
1. Check Render backend is running (`npm start`)
2. Try clearing browser cookies
3. Check browser console for error messages
4. Try incognito/private window

**If you see password prompt:**
- Just enter anything (OTP-based auth may be enabled)
- Check logs for OTP code
- Or check if SMS OTP is being sent

---

## Database Check

```bash
# List all test traders
psql $DATABASE_URL -c "SELECT email, name FROM users WHERE email LIKE '%@test.com' AND user_type='trader';"

# Check their payout methods
psql $DATABASE_URL -c "SELECT u.email, u.name, STRING_AGG(ps.payout_method, ', ') FROM users u JOIN traders t ON u.id=t.user_id JOIN trader_payout_settings ps ON ps.trader_id=t.id WHERE u.email LIKE '%@test.com' GROUP BY u.id, u.email, u.name;"
```

---

## All Set! 🚀

Copy the credentials above and start testing!
