# Key Custody & Account Funding (Pre-Mainnet)

**Status:** Required before any mainnet cutover  
**Audience:** Engineering + Ops + Executive  
**Related:** [MAINNET_CUTOVER_CHECKLIST](./MAINNET_CUTOVER_CHECKLIST.md), [SECURITY_INCIDENT_RUNBOOK](./SECURITY_INCIDENT_RUNBOOK.md)

---

## Non‑negotiable rules

1. **Never reuse testnet keypairs on mainnet.** New escrow, market-maker, SEP-10 signing, and treasury keys.
2. **Never commit secrets** to git, tickets, or chat. Env / secrets manager only.
3. **Escrow secret = real USDC.** Treat like a bank vault key. Compromise = freeze + rotate + incident runbook.
4. **Separate environments:** keep testnet deploy alive; mainnet is a second Render (or equivalent) service with its own env.
5. **Least privilege:** only the production API process needs the escrow secret; humans use admin console, not raw keys.

---

## Accounts Rowan needs on Mainnet

| Account | Purpose | Must have |
|---------|---------|-----------|
| **Escrow** | Holds user USDC during cash-out / buy | XLM for fees + min balance; **USDC trustline** to Circle mainnet issuer; funded USDC float |
| **Market maker** (if still used) | DEX liquidity / path quotes | XLM + USDC + open offers |
| **SEP-10 signing** (if `stellar.toml`) | Auth challenges | Public key in `stellar.toml`; secret only on server |
| **Partner / trader wallets** | Receive release USDC | Each needs **USDC trustline** before release |
| **User wallets** | Send/receive USDC | USDC trustline or refunds stick in `DISPUTE_REFUND_PENDING` |

### Circle USDC issuer (mainnet)

```
Asset code: USDC
Issuer:     GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
```

(Testnet issuer is different — already in `USDC_ISSUER_TESTNET`. Do not mix.)

### Network

```
STELLAR_NETWORK=mainnet
NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
HORIZON_URL=<production provider URL — not free public for volume>
```

---

## Minimum XLM (Stellar network rules)

From Stellar docs (base reserve ≈ **0.5 XLM**):

| Situation | Rough XLM needed |
|-----------|------------------|
| Empty account exists | ~1 XLM (2 × base reserve) |
| +1 USDC trustline | +0.5 XLM |
| +offers / extra signers | +0.5 XLM each |

**Practical escrow funding (pilot):** start with enough XLM that fees never empty the account (e.g. **50–200 XLM** buffer for a tiny private pilot — size to your volume). Top up when health warns on escrow XLM.

**Practical USDC (pilot):** only what you can afford to lose in a worst-case ops error during private pilot. Tiny caps + 1–2 partners first.

---

## How to create a mainnet keypair (engineering)

```bash
cd backend
node -e "const {Keypair}=require('@stellar/stellar-sdk'); const k=Keypair.random(); console.log('PUBLIC', k.publicKey()); console.log('SECRET', k.secret());"
```

1. Generate offline or on a trusted machine.  
2. Store **SECRET** in Render / Vault / AWS Secrets Manager **immediately**.  
3. Record **PUBLIC** in runbooks / ops notes (safe to share with partners for trustlines).  
4. Wipe local console history if the secret was printed.  
5. Fund the public key with XLM from an exchange or existing wallet (**Create Account** / payment).  
6. Submit `changeTrust` for Circle USDC.  
7. Transfer a **small** USDC amount; verify Horizon balance.  
8. Point prod env: `ESCROW_PUBLIC_KEY` / `ESCROW_SECRET_KEY`.

Repeat for market maker if used. **Do not** copy testnet `ESCROW_*` values.

---

## Horizon for production

SDF public Horizon is OK for light testing; for pilot/production prefer a provider with SLA ([Horizon providers](https://developers.stellar.org/docs/data/apis/horizon/providers)):

- Full history noted: **Blockdaemon**, **Validation Cloud**
- Others: QuickNode, Ankr, Obsrvr, Nodies, LOBSTR public

Document the chosen URL + API key rotation owner in the cutover sign-off table.

---

## Getting real USDC onto Stellar

| Path | When to use |
|------|-------------|
| Exchange → withdraw USDC on Stellar to escrow | Fast for tiny pilot |
| **Circle Mint** | Scale / institutional mint-redeem |
| Partner deposits into escrow (documented) | Only with written agreement |

Testnet Circle faucet must be **off** on mainnet (`testnetFaucet` disabled).

---

## Custody checklist (sign before cutover)

- [ ] New escrow keypair generated (not from testnet)
- [ ] Escrow secret only in production secrets store
- [ ] Escrow funded with XLM + USDC trustline confirmed
- [ ] Pilot USDC amount recorded + owner accountable
- [ ] Market maker (if any) same treatment
- [ ] SEP-10 signing key (if used) separate from escrow
- [ ] Production Horizon URL + key documented
- [ ] Who can rotate escrow secret named (2 people minimum)
- [ ] Incident path: [SECURITY_INCIDENT_RUNBOOK](./SECURITY_INCIDENT_RUNBOOK.md) reviewed
- [ ] Orphan recovery scripts **disabled / gated** on mainnet

---

## After compromise (summary)

1. Pause quotes / matching if possible.  
2. Freeze implicated users ([ROWAN_OPS_RUNBOOKS](../ROWAN_OPS_RUNBOOKS.md) §5).  
3. Do **not** move funds ad-hoc without eng + exec.  
4. Follow [SECURITY_INCIDENT_RUNBOOK](./SECURITY_INCIDENT_RUNBOOK.md).  
5. Rotate keys only with a written plan (funds may need migration to a new escrow).

---

## Related

- [MAINNET_CUTOVER_CHECKLIST](./MAINNET_CUTOVER_CHECKLIST.md)  
- [TESTNET_TREASURY_RUNBOOK](./TESTNET_TREASURY_RUNBOOK.md) (testnet only)  
- [STELLAR_STRENGTHEN_TRACKER](./STELLAR_STRENGTHEN_TRACKER.md)
