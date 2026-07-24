# Rowan Product Roadmap — Documentation Index

**Company:** Beta Tech Labs Company Limited (URSB, Uganda)  
**Product:** Rowan — Digital dollar wallet & Stellar on/off-ramp for East Africa  
**Document set version:** 1.0  
**Last updated:** 24 July 2026  
**Primary contact:** Edyelu Andrew — edyeluandrew1@gmail.com  

---

## Purpose

This folder contains the **complete pre-implementation roadmap** for Rowan Phase 2 and beyond. Read these documents **before** starting any new feature work. Phase 1 (Instawards foundation) is complete and submitted; everything here builds on top of that.

---

## Document Map

| # | Document | Description |
|---|----------|-------------|
| 00 | [Executive Overview](./00_EXECUTIVE_OVERVIEW.md) | Vision, positioning, B2B vs B2C, competitive angle |
| 01 | [Current State Assessment](./01_CURRENT_STATE.md) | What exists in the codebase today (% complete per area) |
| 02 | [Master Build List](./02_MASTER_BUILD_LIST.md) | All 55 build items (A–G) with IDs, priority, dependencies |
| 03 | [Phase Timeline & Sequencing](./03_PHASE_TIMELINE.md) | Phase 2A / 2B / 2C / 3 with weeks and milestones |
| 04 | [Compliance & Foundation (A)](./04_COMPLIANCE_FOUNDATION.md) | Bank, TIN, AML, Smile ID, tiered KYC |
| 05 | [Utilities & Wallet (B)](./05_UTILITIES_WALLET.md) | Airtime, bills, savings, yield, virtual cards |
| 06 | [Payment Aggregators (C)](./06_PAYMENT_AGGREGATORS.md) | Yellow Pay, Onafriq, Flutterwave, hybrid architecture |
| 07 | [P2P Trader Upgrades (D)](./07_P2P_TRADER_UPGRADES.md) | Rwanda, merchant agents, dispute reduction |
| 08 | [Multi-Country Expansion (E)](./08_MULTI_COUNTRY.md) | Country registry, per-country rules, West Africa |
| 09 | [Cross-Chain & CCTP (F)](./09_CROSS_CHAIN.md) | Stellar → EVM, Wormhole/LayerZero, timing |
| 10 | [Platform & Operations (G)](./10_PLATFORM_OPS.md) | Domains, monitoring, B2B, partner MoUs |
| 11 | [Decision Record](./11_DECISION_RECORD.md) | Locked decisions, open questions, aggregator/KYC choices |
| 12 | [Implementation Starter Guide](./12_IMPLEMENTATION_STARTER.md) | How to pick the first sprint after reading this set |

---

## Word / PDF Export (Times New Roman, 12pt)

Open **`ROWAN_ROADMAP_PRINT.html`** in Microsoft Word:

1. File → Open → select `docs/roadmap/ROWAN_ROADMAP_PRINT.html`
2. Word will import with **Times New Roman 12pt** styling
3. Save As → `.docx` or export to PDF

Alternatively, copy any `.md` file into Word and apply Times New Roman 12pt to the full document.

---

## Live URLs (Reference)

| Resource | URL |
|----------|-----|
| GitHub | https://github.com/edyeluandrew/rowan.git |
| Backend | https://rowan-1-9crb.onrender.com |
| User app | https://rowan-nt9a.vercel.app/ |
| Admin | https://rowan-dbb4.vercel.app/ |
| Phase 1 evidence | `docs/instawards/` |

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Total build items | 55 |
| Phase 2A items | 18 |
| Phase 2B items | 14 |
| Phase 2C items | 15 |
| Phase 3 items | 8 |
| Countries (current) | Uganda, Kenya, Tanzania |
| Countries (planned near-term) | + Rwanda |
| Blockchain (current) | Stellar testnet/mainnet path |
| Blockchain (future) | EVM via CCTP (Phase 3) |

---

*After reading this index, start with `00_EXECUTIVE_OVERVIEW.md`, then `01_CURRENT_STATE.md`, then `02_MASTER_BUILD_LIST.md`. Use `12_IMPLEMENTATION_STARTER.md` when ready to choose the first sprint.*
