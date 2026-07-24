# Rowan — Decision Record

**Document:** 11 of 12  
**Version:** 1.0 | **Date:** 24 July 2026  

---

## Locked decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | B2C first, B2B later | P2P traders fit consumer flows today | Jul 2026 |
| 2 | Stellar primary chain through Phase 2 | Low fees, USDC native, existing infra | Jul 2026 |
| 3 | Hybrid rails: P2P + Yellow Pay | Traders in EAC; aggregators for scale | Jul 2026 |
| 4 | Utilities before virtual cards | Faster build, daily retention | Jul 2026 |
| 5 | Smile ID over MetaMap for KYC | Better Africa ID coverage | Jul 2026 |
| 6 | Reloadly first for airtime/bills | Lower crypto sensitivity vs Flutterwave | Jul 2026 |
| 7 | Do not build CCTP in Phase 2 | Focus local spend, not DeFi bridges | Jul 2026 |
| 8 | Do not build bridge smart contracts | Use Wormhole/LayerZero SDK in Phase 3 | Jul 2026 |
| 9 | Beta Tech Labs as legal entity | Product unregistered OK under parent co | Jul 2026 |
| 10 | API for money; SDK for KYC only | Clean UX, full backend control | Jul 2026 |

---

## Open decisions (choose before implementation)

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| O1 | First utility to ship | Airtime only vs airtime+bills | **Airtime first** (simplest) |
| O2 | First aggregator corridor | UG vs KE vs both | **UG** (home market) |
| O3 | Savings yield mechanism | Stellar AMM vs partner | **Legal review first** |
| O4 | Virtual card provider | Maplerad vs Bridge | Decide in 2C after card KYC ready |
| O5 | Bank choice | Stanbic vs Ecobank | **Stanbic** (fintech track record) |
| O6 | Mainnet timing | After Phase 2A vs 2B | After 2A utilities stable on testnet |

---

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Pure P2P pan-Africa | Ops nightmare at 20+ countries |
| Flutterwave as crypto ramp | Account freeze risk |
| Build custom KYC from scratch | Smile ID faster + compliant |
| Transak/Ramp white-label | Less differentiation in Africa |
| Skip utilities, only off-ramp | Commodity product vs Pretium/Kotani |

---

## Compliance clarifications

| Myth | Reality |
|------|---------|
| "MetaMap makes us compliant" | No — need AML policy + monitoring + STR |
| "Crypto exchange license needed Day 1" | Depends on UG regulation; frame as digital wallet + utilities |
| "P2P traders replace KYC" | No — users still need tiered KYC |
| "Yellow Pay removes all compliance burden" | No — you remain responsible for end users |

---

## Change log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 24 Jul 2026 | Initial decision record |

---

*End Document 11*
