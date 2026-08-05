#!/usr/bin/env node
/**
 * Add testnet USDC trustline to the utility treasury account.
 *
 * Usage (secret stays local — never commit or put on Render):
 *   UTILITY_USDC_PUBLIC_KEY=G... npm run script:utility-trustline
 *   (prompts for secret if UTILITY_USDC_SECRET_KEY is unset)
 *
 * Or non-interactive:
 *   UTILITY_USDC_PUBLIC_KEY=G... UTILITY_USDC_SECRET_KEY=S... npm run script:utility-trustline
 */
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.staging' });

import readline from 'readline';
import StellarSdk from '@stellar/stellar-sdk';
import config from '../src/config/index.js';
import { USDC_ASSET, networkPassphrase } from '../src/config/stellar.js';

function promptSecret() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter UTILITY_USDC_SECRET_KEY (S...): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const publicKey = process.env.UTILITY_USDC_PUBLIC_KEY || process.argv[2];
let secret = process.env.UTILITY_USDC_SECRET_KEY;

if (!publicKey || !publicKey.startsWith('G') || publicKey.length !== 56) {
  console.error('Missing utility treasury public key.');
  console.error('');
  console.error('Option A — env var (PowerShell):');
  console.error('  $env:UTILITY_USDC_PUBLIC_KEY="G..."');
  console.error('  npm run script:utility-trustline');
  console.error('');
  console.error('Option B — pass as argument:');
  console.error('  npm run script:utility-trustline -- G...your_public_key...');
  console.error('');
  console.error('Option C — add UTILITY_USDC_PUBLIC_KEY=G... to backend/.env.staging');
  process.exit(1);
}

async function resolveSecret() {
  if (secret?.startsWith('S')) return secret;
  if (secret && secret.includes('paste_your_secret')) {
    secret = null;
  }
  if (!secret) {
    secret = await promptSecret();
  }
  if (!secret?.startsWith('S')) {
    console.error('Invalid secret — must start with S');
    process.exit(1);
  }
  return secret;
}

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
  secret = await resolveSecret();

  const keypair = StellarSdk.Keypair.fromSecret(secret);
  if (keypair.publicKey() !== publicKey) {
    console.error('Secret does not match UTILITY_USDC_PUBLIC_KEY.');
    process.exit(1);
  }

  const horizon = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

  console.log(`Network:  ${config.stellar.network}`);
  console.log(`Treasury: ${publicKey}`);
  console.log(`USDC:     ${USDC_ASSET.code}:${USDC_ASSET.issuer}`);

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

  const xlm = account.balances.find((b) => b.asset_type === 'native');
  console.log(`XLM balance: ${xlm?.balance ?? '0'}`);

  const hasTrustline = account.balances.some(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
  if (hasTrustline) {
    const usdc = account.balances.find(
      (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
    );
    console.log(`USDC trustline already exists. Balance: ${usdc?.balance ?? '0'}`);
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

  const updated = await horizon.loadAccount(publicKey);
  const usdc = updated.balances.find(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
  console.log(`USDC balance: ${usdc?.balance ?? '0'}`);
}

main().catch((err) => {
  const codes = err?.response?.data?.extras?.result_codes;
  console.error('Failed:', err.message);
  if (codes) console.error('Stellar codes:', codes);
  process.exit(1);
});
