#!/usr/bin/env node
/**
 * Add testnet USDC trustline to a trader Stellar account.
 *
 * Usage:
 *   TRADER_BOOTSTRAP_SECRET=S... node scripts/bootstrapTraderTrustline.mjs G...
 *
 * Or set TRADER_BOOTSTRAP_PUBLIC + TRADER_BOOTSTRAP_SECRET in .env
 */
import dotenv from 'dotenv';
dotenv.config();

import StellarSdk from '@stellar/stellar-sdk';
import config from '../src/config/index.js';
import { USDC_ASSET, networkPassphrase } from '../src/config/stellar.js';

const publicKey = process.argv[2] || process.env.TRADER_BOOTSTRAP_PUBLIC;
const secret = process.env.TRADER_BOOTSTRAP_SECRET;

if (!publicKey || !publicKey.startsWith('G') || publicKey.length !== 56) {
  console.error('Usage: TRADER_BOOTSTRAP_SECRET=S... node scripts/bootstrapTraderTrustline.mjs <G...>');
  process.exit(1);
}
if (!secret || !secret.startsWith('S')) {
  console.error('Set TRADER_BOOTSTRAP_SECRET=S... in env (never commit this).');
  process.exit(1);
}

const keypair = StellarSdk.Keypair.fromSecret(secret);
if (keypair.publicKey() !== publicKey) {
  console.error('Secret does not match public key.');
  process.exit(1);
}

const horizon = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

async function fundViaFriendbot() {
  const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Friendbot failed: ${res.status} ${text}`);
  }
  console.log('Funded account via Friendbot (or already funded).');
}

async function main() {
  console.log(`Network: ${config.stellar.network}`);
  console.log(`Trader:  ${publicKey}`);
  console.log(`USDC issuer: ${USDC_ASSET.issuer}`);

  let account;
  try {
    account = await horizon.loadAccount(publicKey);
  } catch (err) {
    if (err?.response?.status === 404) {
      console.log('Account not found — funding with Friendbot...');
      await fundViaFriendbot();
      await new Promise((r) => setTimeout(r, 3000));
      account = await horizon.loadAccount(publicKey);
    } else {
      throw err;
    }
  }

  const hasTrustline = account.balances.some(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
  if (hasTrustline) {
    console.log('USDC trustline already exists.');
    return;
  }

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: config.stellarMaxFee || StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_ASSET }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  const result = await horizon.submitTransaction(tx);
  console.log(`USDC trustline created. Tx: ${result.hash}`);
}

main().catch((err) => {
  const codes = err?.response?.data?.extras?.result_codes;
  console.error('Failed:', err.message);
  if (codes) console.error('Stellar codes:', codes);
  process.exit(1);
});
