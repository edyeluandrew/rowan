#!/usr/bin/env node
/**
 * Create a TESTNET MarzPay settlement stand-in:
 *   1. Generate a Stellar keypair (or reuse MARZPAY_SETTLEMENT_SECRET)
 *   2. Fund with Friendbot
 *   3. Establish Circle testnet USDC trustline
 *
 * Testnet only. On mainnet MarzPay must supply their own G... address.
 *
 *   node scripts/bootstrapMarzPaySettlement.mjs
 *   node scripts/bootstrapMarzPaySettlement.mjs --write-env
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import StellarSdk from '@stellar/stellar-sdk';
import config from '../src/config/index.js';
import { USDC_ASSET, networkPassphrase } from '../src/config/stellar.js';

const writeEnv = process.argv.includes('--write-env');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

if (config.stellar.network !== 'testnet') {
  console.error('Refusing to run: STELLAR_NETWORK is not testnet.');
  process.exit(1);
}

const horizon = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

function loadOrCreateKeypair() {
  const existing = process.env.MARZPAY_SETTLEMENT_SECRET;
  if (existing && existing.startsWith('S')) {
    const kp = StellarSdk.Keypair.fromSecret(existing);
    console.log('Reusing MARZPAY_SETTLEMENT_SECRET from env.');
    return kp;
  }
  return StellarSdk.Keypair.random();
}

async function fundViaFriendbot(publicKey) {
  const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok && !/already funded|op_already_exists/i.test(text)) {
    throw new Error(`Friendbot failed: ${res.status} ${text.slice(0, 300)}`);
  }
  console.log('Friendbot: account funded (or already existed).');
}

function upsertEnv(contents, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(contents)) return contents.replace(re, line);
  const trimmed = contents.endsWith('\n') ? contents : `${contents}\n`;
  return `${trimmed}${line}\n`;
}

async function main() {
  const keypair = loadOrCreateKeypair();
  const publicKey = keypair.publicKey();

  console.log(`Network:     ${config.stellar.network}`);
  console.log(`Horizon:     ${config.stellar.horizonUrl}`);
  console.log(`USDC issuer: ${USDC_ASSET.issuer}`);
  console.log(`Public:      ${publicKey}`);

  let account;
  try {
    account = await horizon.loadAccount(publicKey);
  } catch (err) {
    if (err?.response?.status === 404) {
      await fundViaFriendbot(publicKey);
      await new Promise((r) => setTimeout(r, 2500));
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
  } else {
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

  const refreshed = await horizon.loadAccount(publicKey);
  const usdc = refreshed.balances.find(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
  console.log(`USDC balance: ${usdc ? usdc.balance : 'no line'}`);
  console.log(`Explorer: https://stellar.expert/explorer/testnet/account/${publicKey}`);

  if (writeEnv) {
    let contents = fs.readFileSync(envPath, 'utf8');
    contents = upsertEnv(contents, 'MARZPAY_SETTLEMENT_STELLAR', publicKey);
    contents = upsertEnv(contents, 'MARZPAY_SETTLEMENT_SECRET', keypair.secret());
    const fee = process.env.MARZPAY_FEE_STELLAR
      || process.env.UTILITY_USDC_PUBLIC_KEY
      || process.env.TESTNET_FAUCET_PUBLIC_KEY
      || '';
    if (fee) contents = upsertEnv(contents, 'MARZPAY_FEE_STELLAR', fee);
    fs.writeFileSync(envPath, contents);
    console.log(`Wrote MARZPAY_SETTLEMENT_STELLAR (+ secret) to ${envPath}`);
    console.log('Secret is local only. Do not commit .env. Do not use this keypair on mainnet.');
  } else {
    console.log('SECRET=' + keypair.secret());
    console.log('Re-run with --write-env to save into backend/.env');
  }
}

main().catch((err) => {
  const codes = err?.response?.data?.extras?.result_codes;
  console.error('Failed:', err.message);
  if (codes) console.error('Stellar codes:', codes);
  process.exit(1);
});
