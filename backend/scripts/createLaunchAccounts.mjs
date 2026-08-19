/**
 * Create missing Rowan launch wallets on Stellar testnet:
 * platform fee + utility treasury. Reuses existing escrow, SEP-10, and
 * activation (old faucet) keys. Prints PUBLIC keys only.
 *
 * Usage: node backend/scripts/createLaunchAccounts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import * as StellarSdk from '@stellar/stellar-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const HORIZON = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const FRIENDBOT = 'https://friendbot.stellar.org';
const USDC_ISSUER = process.env.USDC_ISSUER_TESTNET
  || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC = new StellarSdk.Asset('USDC', USDC_ISSUER);
const server = new StellarSdk.Horizon.Server(HORIZON);

function upsertEnv(raw, map) {
  const keys = Object.keys(map);
  const seen = new Set();
  const lines = raw.split(/\r?\n/).map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (!m || !(m[1] in map)) return line;
    seen.add(m[1]);
    return `${m[1]}=${map[m[1]]}`;
  });
  for (const key of keys) {
    if (!seen.has(key)) lines.push(`${key}=${map[key]}`);
  }
  return `${lines.filter((l, i, arr) => {
    const k = l.match(/^([A-Z0-9_]+)=/);
    if (!k) return true;
    // drop unused account keys
    return ![
      'MARKET_MAKER_PUBLIC_KEY',
      'MARKET_MAKER_SECRET_KEY',
      'TESTNET_FAUCET_PUBLIC_KEY',
      'TESTNET_FAUCET_SECRET_KEY',
      'TESTNET_FAUCET_USDC_AMOUNT',
      'TESTNET_FAUCET_COOLDOWN_SECONDS',
      'TESTNET_FAUCET_MIN_BALANCE',
      'MARZPAY_SETTLEMENT_STELLAR',
      'MARZPAY_SETTLEMENT_SECRET',
      'MARZPAY_FEE_STELLAR',
      'PLATFORM_FEE_STELLAR',
      'UTILITY_USDC_PUBLIC_KEY',
    ].includes(k[1]);
  }).join('\n').replace(/\n{3,}$/, '\n')}\n`;
}

async function friendbot(publicKey) {
  const res = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) {
    const text = await res.text();
    if (!/already funded|op_already_exists/i.test(text)) {
      throw new Error(`Friendbot failed for ${publicKey.slice(0, 8)}…: ${res.status} ${text.slice(0, 200)}`);
    }
  }
}

async function ensureUsdcTrustline(secret) {
  const kp = StellarSdk.Keypair.fromSecret(secret);
  const account = await server.loadAccount(kp.publicKey());
  const has = account.balances.some(
    (b) => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER
  );
  if (has) return;
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC }))
    .setTimeout(30)
    .build();
  tx.sign(kp);
  await server.submitTransaction(tx);
}

async function createFundedWallet(label) {
  const kp = StellarSdk.Keypair.random();
  console.log(`[${label}] public ${kp.publicKey()}`);
  await friendbot(kp.publicKey());
  await new Promise((r) => setTimeout(r, 2500));
  await ensureUsdcTrustline(kp.secret());
  return kp;
}

async function main() {
  if ((process.env.STELLAR_NETWORK || 'testnet') !== 'testnet') {
    throw new Error('Refusing to create launch accounts unless STELLAR_NETWORK=testnet');
  }

  const existing = fs.readFileSync(envPath, 'utf8');
  const activationPub = process.env.WALLET_ACTIVATION_PUBLIC_KEY
    || process.env.TESTNET_FAUCET_PUBLIC_KEY;
  const activationSec = process.env.WALLET_ACTIVATION_SECRET_KEY
    || process.env.TESTNET_FAUCET_SECRET_KEY;

  if (!activationSec) {
    throw new Error('Need existing TESTNET_FAUCET / WALLET_ACTIVATION secret to keep as ops wallet');
  }

  let feeKp;
  let utilKp;
  if (process.env.PLATFORM_FEE_PUBLIC_KEY && process.env.PLATFORM_FEE_SECRET_KEY) {
    feeKp = StellarSdk.Keypair.fromSecret(process.env.PLATFORM_FEE_SECRET_KEY);
    console.log(`[platform-fee] already set ${feeKp.publicKey()}`);
  } else {
    feeKp = await createFundedWallet('platform-fee');
  }

  if (process.env.UTILITY_TREASURY_PUBLIC_KEY && process.env.UTILITY_TREASURY_SECRET_KEY) {
    utilKp = StellarSdk.Keypair.fromSecret(process.env.UTILITY_TREASURY_SECRET_KEY);
    console.log(`[utility-treasury] already set ${utilKp.publicKey()}`);
  } else {
    utilKp = await createFundedWallet('utility-treasury');
  }

  const next = upsertEnv(existing, {
    WALLET_ACTIVATION_PUBLIC_KEY: activationPub,
    WALLET_ACTIVATION_SECRET_KEY: activationSec,
    WALLET_ACTIVATION_FEE_PAD_XLM: '0.05',
    TESTNET_USDC_AMOUNT: process.env.TESTNET_USDC_AMOUNT || process.env.TESTNET_FAUCET_USDC_AMOUNT || '100',
    TESTNET_USDC_COOLDOWN_SECONDS: process.env.TESTNET_FAUCET_COOLDOWN_SECONDS || '7200',
    TESTNET_USDC_MIN_BALANCE: process.env.TESTNET_FAUCET_MIN_BALANCE || '1',
    PLATFORM_FEE_PUBLIC_KEY: feeKp.publicKey(),
    PLATFORM_FEE_SECRET_KEY: feeKp.secret(),
    UTILITY_TREASURY_PUBLIC_KEY: utilKp.publicKey(),
    UTILITY_TREASURY_SECRET_KEY: utilKp.secret(),
  });

  fs.writeFileSync(envPath, next);
  console.log('Wrote backend/.env (secrets not printed)');
  console.log('KEEP:');
  console.log('  ESCROW             ', process.env.ESCROW_PUBLIC_KEY);
  console.log('  SEP10              ', process.env.SEP10_SIGNING_KEY);
  console.log('  WALLET_ACTIVATION  ', activationPub);
  console.log('  PLATFORM_FEE       ', feeKp.publicKey());
  console.log('  UTILITY_TREASURY   ', utilKp.publicKey());
  console.log('DROPPED from .env: market maker, old faucet names, MarzPay settlement/fee Stellar keys');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
