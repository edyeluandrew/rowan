# Mainnet Cutover Checklist

**Status: NOT READY**

Rowan is currently **testnet demo-ready only**. Do **not** cut over to mainnet until every item below is complete and signed off.

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
- [ ] Mainnet USDC issuer configured (`USDC_ISSUER_MAINNET`)
- [ ] Mainnet escrow account created, funded, USDC trustline established
- [ ] Escrow secret stored securely (Render/env — never in git)
- [ ] Mainnet market maker configured, funded, offers posted
- [ ] Mainnet partner/trader accounts trustlined for USDC
- [ ] Horizon mainnet URL verified

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

### Operations

- [ ] All runbooks in `docs/ops/` reviewed for mainnet
- [ ] Monitoring/alerting active (health, `release_blocked`, escrow balances)
- [ ] On-call rotation defined
- [ ] Rollback plan documented and tested
- [ ] Test transaction plan approved (small mainnet pilot tx)

### Legal / compliance

- [ ] Legal/compliance review complete for jurisdiction(s)
- [ ] Partner agreements signed (manual mobile money model)
- [ ] KYC/limits policy approved for mainnet volume

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

- [Pilot Go/No-Go](./PILOT_GO_NO_GO_CHECKLIST.md)
- [Security Incident](./SECURITY_INCIDENT_RUNBOOK.md)
