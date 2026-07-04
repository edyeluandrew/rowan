# Rowan MVP1 Pilot Runbook

Plain-English guide for running the first live pilot. Use this when something goes wrong, when a user asks for help, or when you are checking the system each day.

**Admin app:** https://rowan-dbb4.vercel.app/login

**Detailed technical runbooks** (deeper steps):
- [Dispute resolution](./ops/DISPUTE_RESOLUTION_RUNBOOK.md)
- [Release blocked (trustline)](./ops/RELEASE_BLOCKED_RUNBOOK.md)
- [Refund retry](./ops/REFUND_RETRY_RUNBOOK.md)
- [Orphan / stuck recovery](./ops/ORPHAN_RECOVERY_RUNBOOK.md)
- [Manual mobile money payout policy](./MANUAL_MOBILE_MONEY_PAYOUT_POLICY.md)

---

## What MVP1 covers

Rowan MVP1 supports three customer flows:

| Flow | What the user does | Matching |
|------|-------------------|----------|
| **Express Cash Out** | Home → Express Cash Out | System auto-picks a trader |
| **Manual sell** | Marketplace → pick trader → Cash Out | Strict: only that trader handles the order |
| **Manual buy** | Marketplace buy tab → pick trader | Trader locks USDC, user sends MoMo |

All flows use escrow: crypto is locked before fiat is released.

---

## Default timings (unless your `.env` overrides them)

| Setting | Default | Meaning |
|---------|---------|---------|
| Trader accept window | **3 min** | Trader must accept a new order |
| Payment window | **5 min** | After accept, trader must send MoMo (sell) or user must pay (buy) |
| Stuck payout flag | **60 min** | Payout submitted but user has not confirmed → admin attention |
| Rematch attempts | **3** | Express orders can retry other traders; manual sell retries the **same** trader |

Typical end-to-end time shown in the app is a **system estimate**, not a guarantee.

---

## Daily operator checklist (5–10 min)

1. **Admin → Overview**
   - Check alerts (especially **stuck payouts**).
   - Note open disputes count.

2. **Admin → Transactions**
   - Filter **Stuck payouts only** if the overview alert fired.
   - Scan anything in `FIAT_PAYOUT_SUBMITTED` older than ~1 hour.

3. **Admin → Disputes**
   - Review anything in `OPEN` or `TRADER_RESPONDED`.
   - Prioritize disputes past SLA / escalated.

4. **Admin → Escrow**
   - Confirm escrow balance looks reasonable (no sudden drop with no matching completes).

5. **Optional:** run smoke test against production API:
   ```bash
   cd backend
   npm run script:smoke-mvp1
   ```

---

## Transaction states — what they mean

| State | Plain English | Who acts next |
|-------|---------------|---------------|
| `QUOTE_REQUESTED` / `QUOTE_CONFIRMED` | User got a quote, not paid yet | User sends XLM |
| `ESCROW_LOCKED` | XLM/USDC is in escrow | System matches trader (or waiting for match) |
| `TRADER_MATCHED` | Trader assigned, waiting for accept | **Trader** must accept |
| `FIAT_PAYOUT_SUBMITTED` | Trader says MoMo was sent | **User** checks phone & confirms (or disputes) |
| `USER_CONFIRMATION_PENDING` | User confirmed receipt | System releases USDC to trader |
| `COMPLETE` | Done | Nobody — appeal window may still apply |
| `DISPUTE_OPENED` | User says money did not arrive | **Trader** responds, then **admin** decides |
| `REFUNDED` | User got crypto back | Closed |
| `RELEASE_BLOCKED` | Could not send USDC (usually trustline) | Fix wallet, then admin retry |

---

## Scenario playbooks

### 1. “I sent XLM but nothing happened”

**Check:** Admin → Transactions → search by user phone / tx id.

| If state is… | Do this |
|--------------|---------|
| `QUOTE_CONFIRMED` | XLM not detected yet. Confirm correct **memo** and **escrow address** on quote screen. Wait ~30s, refresh. |
| `ESCROW_LOCKED` | Deposit OK. Waiting for trader match — check trader availability / float. |
| `TRADER_MATCHED` + no `matched_at` | Trader has not accepted. Ping trader; after 3 min system rematches (Express) or retries same trader (manual sell). |
| `FAILED` / `REFUNDED` | Read `failure_reason`. Tell user refund is processing or complete. |

**Do not** manually change transaction state in the database.

---

### 2. “Trader is not accepting my order”

**Manual sell (marketplace pick):** Rowan will **not** switch to another trader. It waits and retries the **same** trader.

**Express Cash Out:** System can assign a different trader after timeout.

**You:** Contact the trader. If they are offline repeatedly, suspend or fix their ads/float.

---

### 3. “Trader accepted but I never got MoMo”

**Check:** Transaction should be `TRADER_MATCHED` with `matched_at` set, then should move to `FIAT_PAYOUT_SUBMITTED` when trader submits reference.

| Timing | System behavior |
|--------|-----------------|
| Within payment window (~5 min) | Wait — trader still has time |
| After payment window | Express: rematch or refund after max attempts. Manual sell: retry same trader or refund. |
| Trader submitted payout | User should see “confirm receipt” — if money missing, user can **open dispute** |

---

### 4. “Payout stuck — user won't confirm” (`FIAT_PAYOUT_SUBMITTED`)

This is the most common admin attention state.

1. Admin → Transactions → **Stuck payouts only** (or Overview alert link).
2. Open the transaction — check:
   - `payout_reference`
   - payout proof (if uploaded)
   - how long since `fiat_payout_submitted_at`
3. **Contact user:** “Did you receive the MoMo? Please confirm in the app.”
4. If user says **yes** → ask them to tap confirm in app.
5. If user says **no** → ask them to open a **dispute** (or you guide them).
6. If > 60 min with no action → treat as priority review; consider messaging both parties before admin resolution.

---

### 5. Dispute opened

**User side:** Only if money truly did not arrive. False disputes may lead to restrictions.

**Trader side (24h):** Trader should respond with explanation + payment proof if they sent MoMo.

**Admin side:**
1. Admin → Disputes → open the case.
2. Read timeline, user reason, trader response, evidence.
3. Decide:
   - **User wins** → refund USDC to user ([dispute runbook](./ops/DISPUTE_RESOLUTION_RUNBOOK.md))
   - **Trader wins** → release USDC to trader
4. Verify final tx state is `REFUNDED` or `COMPLETE` with on-chain hash.

**Rule:** A payout reference alone is **not** proof. Look at proof images, timestamps, and chat.

---

### 6. Refund failed — “missing USDC trustline”

User won dispute but wallet cannot receive USDC.

1. Tell user to **add USDC trustline** in their Stellar wallet.
2. After they confirm, admin retries refund ([refund retry runbook](./ops/REFUND_RETRY_RUNBOOK.md)).
3. Transaction stays in `DISPUTE_REFUND_PENDING` until on-chain refund succeeds.

---

### 7. Release blocked — trader missing trustline

Same pattern for trader-side USDC release.

1. Trader adds USDC trustline on their linked Stellar address.
2. Admin retries release ([release blocked runbook](./ops/RELEASE_BLOCKED_RUNBOOK.md)).

---

## Who to contact

| Channel | Contact |
|---------|---------|
| WhatsApp support | **+256 792 700 303** |
| Email | **support@rowan.app** |
| In-app | Home / Cash Out / Marketplace → **Rowan MVP pilot** banner |

---

## Suggested in-app MVP disclaimer copy

Use on Home, Cash Out, and Marketplace (pilot banner):

> **Rowan MVP pilot**  
> This is an early release. Trades are handled by real traders and may take longer than shown. Only trade amounts you can afford to wait on. If something looks wrong, open a dispute or contact support before sending more funds.

**Support line (short):**  
> Need help? WhatsApp **+256 792 700 303** or email **support@rowan.app** with your order ID.

**Dispute warning (dispute screen):**  
> Only open a dispute if the money has **not** arrived in your mobile money account. False disputes may lead to account restrictions.

---

## What NOT to do in MVP1

- Do not promise exact payout times — use “typical” language only.
- Do not manually edit transaction rows in Postgres unless you are doing a documented recovery.
- Do not resolve disputes without checking evidence.
- Do not re-enable admin 2FA until the admin frontend supports it (currently bypassed on backend).

---

## Quick links in admin

| Task | Where |
|------|-------|
| See system health & alerts | Overview |
| Find a stuck payout | Transactions → Stuck payouts only |
| Resolve dispute | Disputes → open case → Resolve |
| Check escrow | Escrow |
| Audit what happened | Audit Logs |
| Trader verification / suspend | Traders |

---

## After the pilot

Collect:
- Orders that hit dispute
- Stuck payouts > 60 min
- Refund / release blocked cases
- Trader timeout rate
- User feedback on “typical time” vs reality

Use that to tune timeouts, trader onboarding, and support copy before wider launch.
