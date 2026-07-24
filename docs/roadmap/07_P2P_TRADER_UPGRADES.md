# Category D — P2P Trader Upgrades

**Document:** 07 of 12 | **Items:** D1–D6  
**Version:** 1.0 | **Date:** 24 July 2026  

---

## Context

P2P traders remain Rowan's **competitive moat** in East Africa:
- Verified via admin (`trader_verify_approve`)  
- Escrow on Stellar  
- Audit trail  
- Flexible for large/custom amounts  

Aggregators **supplement** traders; they do not replace them in Phase 2.

---

## D1 — Rwanda Trader Support

- Add RWF to FX engine  
- MTN MoMo Rwanda in payout settings  
- Trader onboarding copy for RW  
- Fraud limits normalized to UGX equivalent  

**Depends on:** E1 country registry, A9  

---

## D2 — Trader Liquidity Dashboard

**Admin + trader views:**
- Float balance vs limit  
- Open requests count  
- Completion rate / SLA  
- Volume by corridor (UG/KE/TZ/RW)  
- Earnings (existing `/trader/earnings` — extend UI)  

---

## D3 — Merchant-Agent Model (Phase 3)

Recruit retail shops (dukas) as liquidity nodes:
- Lock USDC collateral  
- Dispense cash/MoMo for commission  
- Separate "Merchant App" or trader role  

---

## D4 — Automated Payout Verification

Reduce "I sent screenshot" disputes:
- Parse MoMo SMS reference where APIs allow  
- Trader enters transaction ID → optional auto-verify  
- Timeout auto-escalate to dispute  

---

## D5 — Trader Utility Referral Commission

Optional: trader earns small fee when referred user buys airtime through Rowan.

---

## D6 — Dispute Reduction

- Clearer proof-of-payment UI  
- Timer warnings before dispute opens  
- Chat templates for common issues  

---

## Existing code (do not rebuild)

| Feature | Location |
|---------|----------|
| Cashout | `backend/src/routes/cashout.js` |
| Buy | `backend/src/routes/buy.js` |
| Matching | `matchingEngine.js`, `buyMatchingEngine.js` |
| Trader ops | `backend/src/routes/trader.js` |
| Verification | `traderVerificationService.js` |
| Manual MoMo policy | `docs/MANUAL_MOBILE_MONEY_PAYOUT_POLICY.md` |

---

*End Category D*
