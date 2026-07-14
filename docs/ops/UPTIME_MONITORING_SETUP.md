# Uptime & Health Monitoring Setup

**Goal:** Never fly blind — get paged when the API is down or money-critical health fails.  
**Hardening:** [PRE_MAINNET_HARDENING_BACKLOG](./PRE_MAINNET_HARDENING_BACKLOG.md) P0-2 / P0-3  
**Related:** [HEALTH_AND_RATES_MONITORING_RUNBOOK](./HEALTH_AND_RATES_MONITORING_RUNBOOK.md)

---

## What to monitor

| Check | URL / signal | Alert when |
|-------|----------------|------------|
| **Public liveness** | `GET https://rowan-1-9crb.onrender.com/health` | Non-200, timeout, or body not `status=ok` |
| **Deep health** (optional) | `GET /api/v1/admin/system/health` (admin JWT) | `warningLevel` CRITICAL / escrow low |
| **Escrow balances** | Admin → Escrow / Reconciliation | USDC or XLM below your warn floor |

**Cold start:** Render free/sleeping instances can take **30–60+ seconds** to wake. Set monitor **timeout ≥ 60s** and avoid “down” alerts on a single slow wake if you use a sleeper plan — or keep the service always-on for pilot.

**Verified 2026-07-14:** `health` returned `200` with `db/redis/horizon=connected` (cold start ~45s).

---

## Setup — UptimeRobot (free tier is fine for now)

1. Create account at [uptimerobot.com](https://uptimerobot.com) (or Better Stack / Pingdom / Render native).
2. **Add New Monitor**
   - Monitor type: **HTTP(s)**
   - Friendly name: `Rowan API health`
   - URL: `https://rowan-1-9crb.onrender.com/health`
   - Monitoring interval: **5 minutes** (or 1 min if paid)
   - Timeout: **60 seconds** (important for Render cold start)
   - HTTP method: GET
   - Keyword (optional): `"status":"ok"` or `connected`
3. Alert contacts: your phone + email (and Slack webhook if you have one).
4. Save → wait for first green check.
5. **Drill:** temporarily rename the path or pause the Render service → confirm you get an alert → restore.

### Better Stack / alternatives

Same idea: HTTP check on `/health`, 60s timeout, alert to phone.

### Render native

If on a paid Render plan: enable **health checks** on the web service pointing at `/health`, plus email notifications on deploy/crash.

---

## Escrow low-balance practice (P0-3)

Once a week until pilot:

1. Admin → Escrow / system health — note USDC + XLM.
2. Decide warn floors (example for testnet): USDC &lt; 50 or XLM &lt; 20 → investigate.
3. Confirm you know who tops up ([TESTNET_TREASURY_RUNBOOK](./TESTNET_TREASURY_RUNBOOK.md) for faucet; escrow is separate).

For mainnet, set floors in env (`HEALTH_ESCROW_USDC_WARN`, `HEALTH_ESCROW_XLM_CRIT`) and page on breach.

---

## Ownership

| Role | Responsibility |
|------|----------------|
| Ops primary | Receives alerts; first response |
| Eng backup | Render / Horizon / Redis diagnosis |
| Escalation | If escrow empty or Horizon down during open orders → pause quotes if kill-switch exists |

Document names here when assigned:

- Primary: ________________  
- Backup: ________________  

---

## Checklist

- [ ] HTTP monitor on `/health` live
- [ ] Timeout ≥ 60s
- [ ] Alert reaches a human phone/email
- [ ] One intentional fail drill completed
- [ ] Escrow balance check practiced once
- [ ] Owners named above

---

## Session log

| Date | What | Outcome |
|------|------|---------|
| 2026-07-14 | Health URL verified; this runbook written | Ops must still create the external monitor account (5–10 min) |
