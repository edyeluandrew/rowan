# Category G — Platform & Operations

**Document:** 10 of 12 | **Items:** G1–G6  
**Version:** 1.0 | **Date:** 24 July 2026  

---

## G1 — Custom Domains

| Subdomain | Points to |
|-----------|-----------|
| api.rowan.app | Render backend |
| admin.rowan.app | Vercel admin |
| app.rowan.app | Vercel user-web |

Update:
- `stellar.toml` WEB_AUTH_ENDPOINT  
- CORS origins  
- Vercel/Render DNS records  

---

## G2 — External Uptime Monitoring

- UptimeRobot or Better Stack  
- Monitor: `/health`, admin login, user app  
- Alert: email/SMS to on-call  

---

## G3 — Production Alerting Runbook

Document:
1. Who gets paged  
2. Render restart procedure  
3. Database connection failure  
4. Horizon stream disconnect  
5. Aggregator webhook failure  

Partial: Horizon log level fix already deployed.

---

## G4 — Partner MoU Templates

Templates for:
- P2P trader agreement (UG/KE/TZ/RW)  
- Pilot merchant utility partner  
- Data processing with Smile ID  

Draft started in Phase 1 ops work — finalize in 2A.

---

## G5 — B2B Merchant Accounts (Phase 3)

Separate onboarding:
- Business registration docs  
- Tier 3 KYC  
- Higher limits  
- Bulk payout UI  

---

## G6 — B2B Bulk Payout API

```
POST /api/v1/b2b/payouts/batch
{ "items": [{ "phone", "amount", "currency", "reference" }] }
```

Requires G5 + C2 aggregator layer.

---

*End Category G*
