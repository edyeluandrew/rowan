# Security Incident Runbook

**When to use:** Suspected compromise, leaked credentials, or abnormal admin/settlement activity.

---

## Incident types

| Type | Indicators |
|------|------------|
| **Admin compromise** | Unknown admin logins, dispute resolutions you didn't perform, `dangerous_endpoint_blocked` spikes |
| **Trader compromise** | Mass accept/payout-sent, fraudulent references |
| **Wallet/user compromise** | Unauthorized cashouts, dispute spam |
| **Leaked secret/key** | Key in git, ticket, log; unauthorized Horizon txs |
| **ENCRYPTION_KEY exposure** | TOTP secrets at risk; 2FA bypass concern |

---

## JWT / session limitations (current)

Rowan **does not** implement full server-side session revocation today:

- JWTs remain valid until expiry (`JWT_ADMIN_EXPIRES_IN` — default 1h in production).
- Admin logout is client-side (drop token); no server revoke endpoint.
- Disabled accounts (`is_active = false`) are blocked on **next authenticated request**.

Plan incident response accordingly — **disable account + rotate JWT secret** forces re-login for all admins.

---

## Immediate steps

### 1. Contain

- [ ] Disable affected admin/trader/user accounts (`is_active = false` / trader suspend).
- [ ] If admin JWT may be stolen: rotate `JWT_SECRET` on Render (invalidates all tokens).
- [ ] Pause demos if settlement integrity uncertain (communicate to team).
- [ ] Do **not** delete audit logs — export for investigation.

### 2. Assess

- [ ] Review `audit_logs` for actor, action, IP, timestamps.
- [ ] Review `admin_2fa_verification_logs` for failed/success attempts.
- [ ] Check `dangerous_endpoint_blocked` entries.
- [ ] Verify escrow balances on Horizon vs expected.

### 3. Rotate secrets (as applicable)

| Secret | Rotation notes |
|--------|----------------|
| `JWT_SECRET` | Safe to rotate; forces re-auth |
| `ADMIN_PASSWORD` | Reset seeded admin; require 2FA setup |
| `ESCROW_SECRET_KEY` / `MARKET_MAKER_SECRET_KEY` | **High impact** — fund migration; Stellar key rotation |
| `ENCRYPTION_KEY` | **Do not rotate** without TOTP re-encryption migration — breaks stored 2FA secrets |
| `DATABASE_URL` / `REDIS_URL` | Provider rotation per infra runbook |

### 4. Preserve evidence

- Export audit logs, relevant transaction IDs, Horizon tx hashes.
- Screenshot admin console state.
- Do not paste secrets into tickets.

### 5. Recover

- Re-enable 2FA on all admin accounts.
- Verify settlement pipeline (`release_blocked = 0`).
- Document incident timeline.

---

## ENCRYPTION_KEY risk

TOTP secrets (user, trader, admin) are encrypted at rest with `ENCRYPTION_KEY`.

If compromised:

1. Treat all 2FA as potentially exposed.
2. **Do not** rotate key without engineering migration plan.
3. Force 2FA disable + re-enroll per role after key rotation.
4. Audit who accessed admin routes during exposure window.

---

## Admin 2FA during incidents

- Ensure all production admins have 2FA enabled (`POST /auth/admin/2fa/setup`).
- Review `admin_2fa_failed` / `admin_login_failed` audit spikes.
- Rate limits: `RATE_LIMIT_ADMIN_LOGIN_MAX`, `RATE_LIMIT_2FA_VERIFY_MAX`.

---

## What NOT to do

- Do not delete audit logs.
- Do not rotate `ENCRYPTION_KEY` without migration plan.
- Do not expose secrets in chat, logs, or tickets.
- Do not use blocked settlement endpoints to "fix" incident damage.
- Do not force-push git history without coordinated team plan.

---

## Escalation

**P0:** Page engineering + leadership immediately for admin compromise or escrow key leak.

---

## Related

- [Admin Operations Overview](./ADMIN_OPERATIONS_OVERVIEW.md)
- [Pilot Go/No-Go](./PILOT_GO_NO_GO_CHECKLIST.md)
