# Category F — Cross-Chain & CCTP

**Document:** 09 of 12 | **Items:** F1–F4  
**Version:** 1.0 | **Date:** 24 July 2026  

---

## Timing decision: Phase 3 only

**Do not build CCTP in Phase 2A/2B.**

Reasons:
1. Target users need **local spend** (MoMo, airtime), not Ethereum DeFi  
2. Stellar USDC already optimal for East Africa fees/speed  
3. Bridge security risk distracts from core product  
4. Circle CCTP on Stellar is live but user demand unproven for Rowan cohort  

---

## How CCTP works (reference)

1. **Burn** USDC on Stellar via CCTP contract  
2. **Attest** Circle signs burn event  
3. **Mint** native USDC on destination chain (Base, Arbitrum, etc.)  

No wrapped tokens; 1:1 native USDC both sides.

---

## F1 — CCTP research + POC

- Read Circle CCTP Stellar docs  
- Testnet burn on Stellar → mint on Base  
- Document gas relayer requirements  

---

## F2 — Wormhole or LayerZero SDK

**Do not write custom bridge contracts.**

Use SDK that invokes CCTP under the hood:
- Unified JS/TS API  
- Gas relayer for destination chain  
- User does not need ETH for gas on receive  

---

## F3 — Multi-chain USDC receive

User settings: "Receive USDC on: Stellar | Base | Arbitrum"  
Default remains Stellar for African users.

---

## F4 — EVM deposit detection

If accepting Base USDC deposits:
- Alchemy/QuickNode webhook  
- Credit user Stellar balance after bridge OR hold on EVM ledger  

Reference: `docs/ops/STELLAR_STRENGTHEN_TRACKER.md` (future plan mention)

---

## When to revisit

Trigger Phase 3 cross-chain when:
- [ ] 1,000+ MAU on Stellar product  
- [ ] User requests for Base/ETH DeFi access documented  
- [ ] Mainnet Stellar USDC volume stable  
- [ ] Legal review for multi-chain custody  

---

*End Category F*
