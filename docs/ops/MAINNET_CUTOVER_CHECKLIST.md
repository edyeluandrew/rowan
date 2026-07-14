# Mainnet Cutover Checklist

**Status: NOT READY**

Rowan is currently **testnet demo-ready only**. Do **not** cut over to mainnet until every item below is complete and signed off.

**Master index:** [docs/README.md](../README.md)  
**Harden first:** [PRE_MAINNET_HARDENING_BACKLOG](./PRE_MAINNET_HARDENING_BACKLOG.md) · [STELLAR_STRENGTHEN_TRACKER](./STELLAR_STRENGTHEN_TRACKER.md)  
**Keys:** [KEY_CUSTODY_AND_ACCOUNT_FUNDING](./KEY_CUSTODY_AND_ACCOUNT_FUNDING.md)

---

## Prerequisites (all required)

### Fiat and quotes

- [x] Live fiat FX provider integrated ([FUTURE_FIAT_FX_PROVIDER.md](../FUTURE_FIAT_FX_PROVIDER.md) — Phase 2H-4)
- [ ] `ALLOW_STATIC_FIAT_RATES=false` (unless documented executive exception)
- [ ] `ALLOW_FALLBACK_QUOTES=false`
- [ ] `FX_RATE_MAX_AGE_SECONDS` / `FIAT_FX_STALE_SECONDS` configured for production SLA
- [ ] `ALLOW_STALE_FX_RATES=false` on mainnet
- [ ] Health shows live FX (`fx_source=LIVE`) for UGX/KES/TZS, not STATIC-only WARNING
- [ ] Monitor ExchangeRate-API (or chosen provider) freshness and rate-limit failures

### Stellar network

- [ ] `STELLAR_NETWORK=mainnet`
- [ ] Mainnet USDC issuer configured (`USDC_ISSUER_MAINNET` = Circle `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`)
- [ ] **New** mainnet escrow account created (not testnet keys) — see [KEY_CUSTODY](./KEY_CUSTODY_AND_ACCOUNT_FUNDING.md)
- [ ] Escrow funded with XLM; USDC trustline established; small USDC float loaded
- [ ] Escrow secret stored securely (secrets manager — never in git)
- [ ] Mainnet market maker configured, funded, offers posted (if still in product)
- [ ] Mainnet partner/trader accounts trustlined for USDC
- [ ] Production Horizon URL verified (prefer SLA provider; document which)
- [ ] Testnet faucet / Friendbot paths **disabled**
- [ ] Separate production deploy kept alongside testnet

### Security

- [ ] All admin accounts have 2FA enabled
- [ ] `ENCRYPTION_KEY` set, stable, documented rotation procedure
- [ ] TOTP secrets encrypted; migration tested
- [ ] `JWT_ADMIN_EXPIRES_IN` ≤ 1h production
- [ ] Rate limits production-tested (`RATE_LIMIT_*`)
- [ ] CORS allowlist configured (no wildcard in production)
- [ ] Secrets rotated from any testnet/demo values
- [ ] Git history reviewed/scrubbed for leaked secrets
- [ ] Cashout status authenticated (Phase 2H-2 ✓)
- [ ] Dangerous admin endpoints remain blocked (Phase 2H-1/2 ✓)
- [ ] KYC document upload ownership checks live (user can only attach own `kyc/<userId>/…` keys)
- [ ] Pause-quotes / kill-switch path documented and tested

### Compliance / AML (code exists — must be operational)

- [ ] KYC queue staffed; approve/reject drill completed
- [ ] Sanctions screening enabled; OFAC list loaded / refresh schedule set (`npm run script:load-ofac`)
- [ ] Payout screening policy decided (require payout name vs accept gap) — see hardening backlog P1-8
- [ ] Fraud alerts triaged daily for pilot window
- [ ] User freeze/unfreeze drill completed
- [ ] Escrow reconciliation checked and within tolerance before flip
- [ ] [ROWAN_OPS_RUNBOOKS](../ROWAN_OPS_RUNBOOKS.md) reviewed by ops

### Operations

- [ ] All runbooks in `docs/ops/` + `ROWAN_OPS_RUNBOOKS.md` reviewed for mainnet
- [ ] Monitoring/alerting active (health, `release_blocked`, escrow balances)
- [ ] On-call rotation defined
- [ ] Rollback plan documented and tested
- [ ] Test transaction plan approved (small mainnet pilot tx)
- [ ] Dispute dismiss policy: **do not dismiss** while escrow held until P1-7 fixed
- [ ] Stuck-refund retry path practiced from dispute desk UI

### Legal / compliance

- [ ] Legal/compliance review complete for jurisdiction(s) (Kenya first recommended)
- [ ] Partner agreements signed (manual mobile money model)
- [ ] KYC/limits policy approved for mainnet / pilot volume
- [ ] Pilot caps (per-tx / daily) written and enforced

### Orphan / recovery

- [ ] Orphan recovery script **disabled or heavily restricted** on mainnet
- [ ] Executive/legal approval for any recovery tooling on mainnet

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | ☐ |
| Operations | | | ☐ |
| Legal/Compliance | | | ☐ |
| Executive | | | ☐ |

**Do not proceed until all boxes checked.**

---

## Related

- [Stellar Strengthen Tracker](./STELLAR_STRENGTHEN_TRACKER.md)
- [Pre-Mainnet Hardening Backlog](./PRE_MAINNET_HARDENING_BACKLOG.md)
- [Key Custody & Account Funding](./KEY_CUSTODY_AND_ACCOUNT_FUNDING.md)
- [Pilot Go/No-Go](./PILOT_GO_NO_GO_CHECKLIST.md)
- [Security Incident](./SECURITY_INCIDENT_RUNBOOK.md)
- [Docs index](../README.md)
