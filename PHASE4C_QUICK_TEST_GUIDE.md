# Phase 4C Quick Test Guide

## Test Scenarios

### Scenario 1: Wallet User - Normal Cashout (No Dispute)

**Expected Flow:**
1. Transaction arrives at FIAT_PAYOUT_SUBMITTED
2. Wallet shows "Money Sent by Trader" with Yes/No buttons
3. User clicks "Yes, I received it"
4. UI shows "Cashout Complete"

**How to test:**
```
1. Start cashout flow
2. Complete quote → ESCROW_LOCKED
3. Wait for TRADER_MATCHED
4. Wait for FIAT_PAYOUT_SUBMITTED
5. Open transaction detail
6. Should show "Money Sent by Trader" card
7. Click "Yes, I received it"
8. Confirm receipt button in modal
9. State changes to COMPLETE
10. Shows "Cashout Complete" with receipt button
```

---

### Scenario 2: Wallet User - Opens Dispute (User Wins)

**Expected Flow:**
1. Transaction at FIAT_PAYOUT_SUBMITTED
2. User clicks "I did not receive it"
3. DisputeConfirmModal appears
4. User confirms
5. State changes to DISPUTE_OPENED
6. Shows "Dispute Under Review" card
7. Admin resolves for user → DISPUTE_REFUND_PENDING
8. Shows "Dispute Resolution in Progress"
9. Transitions to REFUNDED
10. Shows "Dispute Resolved - trader did not receive USDC"

**How to test:**
```
1. Get transaction to FIAT_PAYOUT_SUBMITTED
2. Click "I did not receive it"
3. Modal should warn about escrow lock
4. Click "Open Dispute"
5. Verify state changes to DISPUTE_OPENED
6. Check TransactionDetail shows "Dispute Under Review"
7. Simulate admin resolving for user via backend
8. Verify socket 'dispute_resolved' event received
9. State should change to REFUNDED
10. Verify messaging: "Transaction resolved in your favor"
```

---

### Scenario 3: Wallet User - Opens Dispute (Trader Wins)

**Expected Flow:**
1. Transaction at FIAT_PAYOUT_SUBMITTED
2. User clicks "I did not receive it" → DISPUTE_OPENED
3. Admin resolves for trader
4. State changes to DISPUTE_RELEASE_PENDING
5. Shows "Admin approved release"
6. Transitions to COMPLETE
7. Shows "Cashout Complete" with release tx

**How to test:**
```
1. Get transaction to FIAT_PAYOUT_SUBMITTED
2. Open dispute → DISPUTE_OPENED
3. Simulate admin resolving for trader via backend
4. Verify state changes to DISPUTE_RELEASE_PENDING
5. Should show "Admin approved release to trader"
6. Verify escrow release happens
7. State changes to COMPLETE
8. Shows stellar_release_tx hash in detail
```

---

### Scenario 4: Trader - Payment Flow (No Dispute)

**Expected Flow:**
1. Trader sees TRADER_MATCHED
2. Step indicator shows step 1
3. "I've Sent Payment" button enabled
4. Trader clicks button → FIAT_PAYOUT_SUBMITTED
5. Shows "Payment Submitted" card
6. Message: "Waiting for customer confirmation"
7. Customer confirms → COMPLETE
8. Shows "USDC Released" with release tx

**How to test:**
```
1. Start trader payout flow
2. Verify "I've Sent Payment" button is enabled
3. Click button
4. Modal appears to confirm payout
5. Confirm payout submission
6. State changes to FIAT_PAYOUT_SUBMITTED
7. Shows "Payment Submitted" card in RequestDetail
8. Wait for customer confirmation
9. State changes to COMPLETE
10. Shows USDC Released with tx hash
```

---

### Scenario 5: Trader - Sees Dispute, Cannot Release

**Expected Flow:**
1. Trader at FIAT_PAYOUT_SUBMITTED
2. Customer opens dispute
3. State changes to DISPUTE_OPENED
4. "I've Sent Payment" button DISABLED
5. Shows "Dispute Opened - customer reported no receipt"
6. Message: "Please wait while admin reviews"
7. Trader cannot proceed
8. Admin resolves
9. State changes to DISPUTE_RELEASE_PENDING or DISPUTE_REFUND_PENDING
10. Shows appropriate resolution card

**How to test:**
```
1. Get trader to FIAT_PAYOUT_SUBMITTED
2. Customer opens dispute on their end
3. Trader should see state change to DISPUTE_OPENED
4. Verify "I've Sent Payment" button is DISABLED
5. TraderDisputeStatusCard should show "Dispute Opened"
6. Message should mention customer reported no receipt
7. Try clicking disabled button - should not work
8. Simulate admin resolution
9. Verify state transitions appropriately
```

---

### Scenario 6: Error Handling

**Expected Flow:**
1. openDispute() fails with backend error
2. DisputeConfirmModal closes
3. Error message appears below detail cards
4. User can retry

**How to test:**
```
1. Intentionally break openDispute() endpoint
2. Try to open dispute
3. Verify modal closes
4. Check error message appears
5. Verify can still interact with UI
6. Fix endpoint
7. Retry dispute opening
8. Should work normally
```

---

## UI Verification Checklist

### Wallet Detail Screen

- [ ] Status badge shows correct label and color
- [ ] Amounts display correctly
- [ ] Network shows correct icon/label
- [ ] State-specific card appears below banner
- [ ] ReceiptConfirmationCard shows for FIAT_PAYOUT_SUBMITTED
- [ ] Buttons are properly styled and responsive
- [ ] DisputeConfirmModal is modal (backdrop + centered)
- [ ] Timeline/progress shows current state
- [ ] Receipt button appears for COMPLETE
- [ ] All fields copy-able where applicable
- [ ] stellar_release_tx shows when available
- [ ] Formatting of dates/amounts is correct
- [ ] Dark theme colors consistent

### Trader Detail Screen

- [ ] Status badge shows correct state
- [ ] Step indicator shows correct progress
- [ ] SLA countdown displays if applicable
- [ ] TraderDisputeStatusCard shows for dispute states
- [ ] "I've Sent Payment" button disabled for DISPUTE_OPENED
- [ ] Payout instructions show at correct step
- [ ] Phone reveal functionality works
- [ ] All amounts formatted correctly
- [ ] Buttons properly labeled
- [ ] ConfirmPayoutModal displays correctly
- [ ] Socket updates working in real-time
- [ ] Loading spinners show appropriately

---

## State Transition Tests

### Wallet User Expected Transitions

```
FIAT_PAYOUT_SUBMITTED
  ├─ [Confirm] → USER_CONFIRMATION_PENDING → COMPLETE
  └─ [Dispute] → DISPUTE_OPENED → [Admin] → DISPUTE_RELEASE_PENDING|DISPUTE_REFUND_PENDING → COMPLETE|REFUNDED
```

### Trader Expected Transitions

```
TRADER_MATCHED
  └─ [Send Payout] → FIAT_PAYOUT_SUBMITTED
       ├─ [No dispute] → USER_CONFIRMATION_PENDING → COMPLETE
       └─ [Dispute] → DISPUTE_OPENED → DISPUTE_RELEASE_PENDING|DISPUTE_REFUND_PENDING → COMPLETE|REFUNDED
```

---

## Backend Verification

Before testing frontend, verify backend is running:

✅ **POST /api/v1/user/transactions/:id/confirm-receipt**
- Should transition to COMPLETE
- Should return updated transaction

✅ **POST /api/v1/user/transactions/:id/dispute**
- Should accept reason parameter
- Should transition to DISPUTE_OPENED
- Should return dispute details

✅ **Socket Events**
- 'dispute_opened': { transactionId, ... }
- 'dispute_resolved': { transactionId, newState, ... }

---

## Common Issues & Solutions

### Issue: DisputeStatusCard not showing

**Solution:**
- Check state matches exactly (case-sensitive)
- Verify state is one of: DISPUTE_OPENED, DISPUTE_RELEASE_PENDING, DISPUTE_REFUND_PENDING, RELEASE_BLOCKED, REFUNDED
- Check browser console for import errors

### Issue: ReceiptConfirmationCard not showing

**Solution:**
- State must be FIAT_PAYOUT_SUBMITTED or USER_CONFIRMATION_PENDING
- Check transaction detail is loading correctly
- Verify API response includes state field

### Issue: "I've Sent Payment" button not disabled during dispute

**Solution:**
- Verify state is exactly DISPUTE_OPENED (case matters)
- Check that RequestDetail is updating with socket events
- Verify socket is connected (check console)

### Issue: Modal not appearing for dispute confirmation

**Solution:**
- Click must come from "I did not receive it" button
- Modal controlled by showDisputeModal state
- Check browser console for errors

### Issue: Stellar release tx not showing

**Solution:**
- stellar_release_tx might be empty initially
- Shows only after COMPLETE state transition
- Check API response includes this field

---

## Mobile Testing Tips

1. **Use responsive browser devtools** to test mobile dimensions
2. **Test on actual devices** if possible for touch/swipe
3. **Clear browser cache** after updating components
4. **Check console** for warnings/errors
5. **Verify socket** connection in Network tab
6. **Test error states** by simulating API failures
7. **Test loading states** by slowing down network (DevTools)
8. **Check accessibility** - all buttons must be keyboard accessible
9. **Test dark theme** colors match design
10. **Verify all responsive** breakpoints work correctly

---

## Regression Testing

Ensure these normal flows still work:

- [ ] Cashout quote generation
- [ ] XLM deposit flow
- [ ] USDC swap
- [ ] Normal transaction completion
- [ ] Receipt generation
- [ ] Trader payout sent flow
- [ ] Earnings history
- [ ] Profile updates
- [ ] Navigation between screens
- [ ] Socket reconnection after network loss

---

## Sign-Off Checklist

- [ ] All test scenarios pass
- [ ] UI matches design specifications  
- [ ] Dark theme colors correct
- [ ] Error messages clear and helpful
- [ ] Loading states show properly
- [ ] Socket events received correctly
- [ ] No console errors or warnings
- [ ] Responsive on mobile devices
- [ ] Buttons properly styled and clickable
- [ ] Text formatting/alignment correct
- [ ] Icons display properly
- [ ] Modal backdrop and styling correct
- [ ] All state transitions work
- [ ] Can complete normal cashout flow
- [ ] Can open and resolve disputes
- [ ] Traders prevented from releasing during dispute
