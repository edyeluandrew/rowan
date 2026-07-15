# Rowan Testnet Pilot Brief

**Status:** ACTIVE — invite-only testnet pilot  
**Duration:** 2–4 weeks (review at end of Week 2)  
**Network:** Stellar **testnet** only — no real USDC, no real MoMo unless partners agree separately  
**Last updated:** 2026-07-14

**Ops:** [MVP1_PILOT_RUNBOOK](../MVP1_PILOT_RUNBOOK.md) · [STELLAR_STRENGTHEN_TRACKER](./STELLAR_STRENGTHEN_TRACKER.md) · [PILOT_GO_NO_GO](./PILOT_GO_NO_GO_CHECKLIST.md)

---

## What this pilot is

A **controlled test** of Rowan cash-out (and optional buy) with real humans on **testnet**:

- Users send **test USDC** to escrow and receive **simulated or partner-marked** mobile money.
- Traders are **verified partners** (Edyelu Andrew, Muhereza Alouzious) or ops-seeded test traders.
- You watch every order in the first week; fix UX and bugs before widening.

This is **not** a public launch, **not** mainnet, and **not** a promise of instant real-money payouts.

---

## Who is invited

| Wave | When | Who | Target size |
|------|------|-----|-------------|
| **Wave 1** | Week 1 | Friends / early believers you trust | **5** users |
| **Wave 2** | Week 2+ | Same group + referrals you approve | **10–20** total |

**Do not** post public signup links or promise real money until [MAINNET_CUTOVER_CHECKLIST](./MAINNET_CUTOVER_CHECKLIST.md) is signed.

---

## Pilot caps (edit before Wave 2)

| Limit | Suggested testnet value |
|-------|-------------------------|
| Max per transaction | **50 USDC** (testnet) |
| Max per user per day | **200 USDC** (testnet) |
| Active open orders per user | **2** |
| Countries / rails | Uganda MTN/Airtel (partner float); others by agreement only |
| KYC | Light for testnet; full KYC required before any **real-money** pilot |

Partners: caps in [PARTNER_MOMO_PILOT_ADDENDUM](./PARTNER_MOMO_PILOT_ADDENDUM.md) should match this table.

---

## Apps & URLs

| Role | URL / app |
|------|-----------|
| User wallet (web) | Your deployed user-web URL or local dev |
| Trader app | Trader web / mobile build you share with partners |
| Admin | https://rowan-dbb4.vercel.app/login |
| API health | https://rowan-1-9crb.onrender.com/health |

**Cold start:** Render API may take **45–60s** on first request after idle. Tell testers to wait or retry once.

---

## Tester onboarding (send this block)

1. **Create a Rowan account** (email signup).
2. **Fund testnet USDC** — ops runs faucet or shares funded test wallet:
   - `POST /api/v1/testnet/fund-usdc` (non-prod) or [TESTNET_TREASURY_RUNBOOK](./TESTNET_TREASURY_RUNBOOK.md)
3. **Try Express Cash Out** first (smallest amount, e.g. 10 USDC).
4. **After trader marks payout sent** — check your phone if partner sent real MoMo (optional); otherwise tap **Confirm receipt** when satisfied for the drill.
5. **Problems?** Contact support (below) with **transaction id** or screenshot.

**Flows to test in order:** Express cash-out → Manual marketplace sell → (optional) buy.

---

## Partner onboarding (30 min call)

Before Wave 1 orders hit partners:

1. Signed [PARTNER_MOMO_PILOT_ADDENDUM](./PARTNER_MOMO_PILOT_ADDENDUM.md) + Trader Agreement v1.0.
2. Admin: trader **verified**, correct **Stellar wallet**, **USDC trustline** on testnet.
3. Walkthrough: notification → **Accept** → send MoMo (or simulate) → **Payout sent** → wait for user confirm.
4. Show **Dispute** button and when to call ops.

Test traders (seeded): `test.trader.flow@rowan.local` (Edyelu), trader2 (Muhereza) — confirm live in admin before pilot.

---

## Support channel

Fill before inviting users:

| | |
|--|--|
| **Primary contact** | _________________________________ |
| **WhatsApp / Telegram** | _________________________________ |
| **Email** | _________________________________ |
| **Hours** | e.g. 09:00–21:00 EAT, 7 days during pilot |
| **Escalation** | Ops → admin dispute desk → engineering |

**User message template:**  
*"Rowan testnet pilot — test USDC only. If stuck, send your order id and we'll check admin. Not real money until we announce otherwise."*

---

## Daily ops (you, 5–10 min)

Follow [MVP1_PILOT_RUNBOOK](../MVP1_PILOT_RUNBOOK.md):

1. Admin → **Overview** (alerts, stuck payouts, disputes).
2. **Transactions** — anything in `FIAT_PAYOUT_SUBMITTED` > 1 hour.
3. **Escrow** — balance sane vs completes.
4. Optional: `cd backend && npm run script:smoke-mvp1`

Log incidents in tracker session log or a simple spreadsheet: date, tx id, issue, resolution.

---

## Stop conditions (pause invites immediately)

| Trigger | Action |
|---------|--------|
| Money safety bug (double release, wrong amount, stuck escrow) | **Stop** all new orders; fix or rollback |
| Horizon / escrow down > 30 min | Pause quotes; comms to users |
| Partner unavailable 24h+ with open orders | Ops completes or refunds per runbook |
| Dispute rate > **20%** of completes in a day | Pause Wave 2; root-cause |
| Any mainnet or real-USDC confusion | Clarify comms; no mainnet flip |

Kill switch / pause quotes: document in [PRE_MAINNET_HARDENING_BACKLOG](./PRE_MAINNET_HARDENING_BACKLOG.md) (P1-11) — until built, use admin trader offline + env pause if available.

---

## Week-by-week goals

| Week | Goal | Exit signal |
|------|------|-------------|
| **0** | A1 PASS, uptime monitor, partners signed + trained | This brief shared with partners |
| **1** | 5 users, you watch every order | ≥3 clean completes; no P0 bugs open |
| **2** | 10–20 users, both partners | Disputes resolvable without guessing; daily checklist < 10 min |
| **3** | Review | Decide: extend testnet / code hardening / plan **private real-money** pilot |

**E2E scoreboard:** [STELLAR_STRENGTHEN_TRACKER](./STELLAR_STRENGTHEN_TRACKER.md) — target A1 + B1–B4 + C1 + D1–D2 + E2–E3 PASS by end of pilot.

---

## After the pilot

| Outcome | Next step |
|---------|-----------|
| Calm, partners reliable | Legal opinion → mainnet keys → **tiny** real-money pilot with hard caps |
| UX bugs, no money issues | Fix backlog + another testnet week |
| Money or trust issues | **No** real-money pilot until root cause closed |

Do **not** flip `STELLAR_NETWORK=mainnet` without [MAINNET_CUTOVER_CHECKLIST](./MAINNET_CUTOVER_CHECKLIST.md) signatures.

---

## Quick checklist — pilot GO

- [x] Uptime monitor on `/health`
- [ ] A1 logged PASS in [STELLAR_STRENGTHEN_TRACKER](./STELLAR_STRENGTHEN_TRACKER.md) (tx hashes + Rowan tx id)
- [ ] Partners signed + wallet/trustline verified in admin
- [ ] Support channel filled in above
- [ ] Wave 1 invite list (5 names)
- [ ] Testnet USDC faucet path tested for new users

When all boxes are checked → **send Wave 1 invites**.
