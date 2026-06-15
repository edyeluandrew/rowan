# Orphan Recovery Runbook

**When to use:** Legacy testnet transactions have USDC locked in escrow with no viable settlement path (demo cleanup only).

**Script:** `backend/scripts/orphanRecoverySweep.mjs`

---

## What orphan transactions are

"Orphans" here are **legacy testnet** transactions that:

- Reached post-swap USDC in escrow (`stellar_deposit_tx` + `stellar_swap_tx` present)
- Stalled in late fiat/settlement states with a specific test trader
- Have no release, refund, or prior recovery hash
- Have no open dispute and no reserved float

They are **not** normal production failures — recovery sweeps USDC to a designated **testnet recovery wallet**, not back to the user.

---

## Dry-run first (always)

Default is **dry-run** — no on-chain transactions:

```bash
cd backend
node scripts/orphanRecoverySweep.mjs
```

Review console output: candidate count, amounts, skip reasons.

---

## Execute (testnet only)

Requires **both** flags:

```bash
node scripts/orphanRecoverySweep.mjs --execute --i-confirm-testnet-only
```

---

## Strict guards (enforced by script)

| Guard | Detail |
|-------|--------|
| **Testnet only** | Aborts if `STELLAR_NETWORK !== 'testnet'` or mainnet flag set |
| **Exact target states** | `TRADER_MATCHED`, `FIAT_PAYOUT_SUBMITTED`, `USER_CONFIRMATION_PENDING` |
| **Test trader only** | `trader.email = testuser2@rowan.test` |
| **No settlement hashes** | No `stellar_release_tx`, `stellar_refund_tx`, or `admin_recovery_tx` |
| **No dispute** | `dispute_count = 0` |
| **No reserved float** | `trader_payout_settings.reserved_float = 0` |
| **On-chain verified** | Deposit + swap txs exist on Horizon |
| **Protected users** | Skips users whose email contains: `ejoku`, `blaire`, `localhost8081` |
| **Recovery wallet** | `TESTNET_RECOVERY_WALLET_PUBLIC_KEY` must be set with USDC trustline |

---

## When recovery sweep is acceptable

- Testnet demo cleanup after confirmed abandoned test flows
- Engineering-approved inventory reduction
- **Never** as a substitute for user refund on real pilot transactions

---

## Why orphans become FAILED, not REFUNDED

The sweep sends USDC to the **recovery wallet**, not the original user's Stellar address. Marking `REFUNDED` would misrepresent that the user received funds.

Script sets:

- `state` → `FAILED`
- `failure_reason` → `legacy_testnet_orphan_recovery`
- `admin_recovery_tx` → on-chain sweep hash
- `admin_recovery_wallet` / `admin_recovery_at` → recovery metadata

**Do not** mark `REFUNDED` unless the original user received an on-chain refund via normal refund paths.

---

## Metadata fields

| Field | Purpose |
|-------|---------|
| `admin_recovery_tx` | Stellar hash of sweep to recovery wallet |
| `admin_recovery_wallet` | Destination public key |
| `admin_recovery_at` | Timestamp of recovery |

These are **not** user refunds (`stellar_refund_tx` remains null).

---

## Expected audit events

| Action | When |
|--------|------|
| `orphan_recovery_batch_started` | Batch begin |
| `orphan_recovery_started` | Per transaction |
| `orphan_recovery_succeeded` | On-chain sweep OK |
| `orphan_recovery_failed` | Sweep failed |
| `orphan_recovery_batch_finished` | Batch end |

Auto orphan job (separate from script): `orphan_refund_succeeded`, `orphan_refund_failed`, `orphan_refund_blocked_no_trustline`.

---

## Environment variables

| Variable | Required |
|----------|----------|
| `TESTNET_RECOVERY_WALLET_PUBLIC_KEY` | Yes (execute) |
| `STELLAR_NETWORK=testnet` | Yes |
| `ESCROW_SECRET_KEY` | Yes (server/script runtime) |

Job-queue orphan timeouts (auto path): `ORPHAN_FIAT_SENT_MINUTES` (default 60), `ORPHAN_MATCHED_MINUTES` (default 30).

---

## Never on mainnet

**Do not run** without executive, legal, and engineering approval. Mainnet sweeps are irreversible and may constitute misappropriation if misapplied.

---

## Related

- [Refund Retry](./REFUND_RETRY_RUNBOOK.md)
- [Admin Operations Overview](./ADMIN_OPERATIONS_OVERVIEW.md)
