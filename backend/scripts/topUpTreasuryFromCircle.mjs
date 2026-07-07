#!/usr/bin/env node
/**
 * Top up Rowan testnet treasury with real Circle USDC via temporary helper wallets.
 *
 * Circle faucet is manual (website). This script automates everything on Stellar:
 *   prepare → friendbot + USDC trustline on helper wallets
 *   sweep   → payment helper USDC → treasury (TESTNET_FAUCET_SECRET_KEY)
 *   status  → treasury + helper balances
 *
 * Usage (from backend/):
 *   node scripts/topUpTreasuryFromCircle.mjs prepare --count 10
 *   node scripts/topUpTreasuryFromCircle.mjs circle-guide
 *   node scripts/topUpTreasuryFromCircle.mjs sweep
 *   node scripts/topUpTreasuryFromCircle.mjs status
 *
 * Requires in .env:
 *   STELLAR_NETWORK=testnet
 *   TESTNET_FAUCET_SECRET_KEY=S...   (treasury — receives swept USDC)
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import StellarSdk from '@stellar/stellar-sdk';
import config from '../src/config/index.js';
import { USDC_ASSET, networkPassphrase } from '../src/config/stellar.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HELPERS_FILE = path.join(__dirname, '.treasury-helpers.json');
const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const SETTLE_MS = 2500;

function treasuryKeypair() {
  const secret =
    config.testnetFaucet.secretKey ||
    process.env.TESTNET_FAUCET_SECRET_KEY;
  if (!secret?.startsWith('S')) {
    throw new Error('Set TESTNET_FAUCET_SECRET_KEY=S... in backend/.env');
  }
  return StellarSdk.Keypair.fromSecret(secret);
}

function horizon() {
  if (config.stellar.network !== 'testnet') {
    throw new Error('This script is for testnet only. Set STELLAR_NETWORK=testnet');
  }
  return new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
}

async function fundViaFriendbot(publicKey) {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Friendbot failed for ${publicKey}: ${res.status} ${text}`);
  }
}

async function ensureUsdcTrustline(keypair, server) {
  let account;
  try {
    account = await server.loadAccount(keypair.publicKey());
  } catch (err) {
    if (err?.response?.status === 404) {
      await fundViaFriendbot(keypair.publicKey());
      await sleep(SETTLE_MS);
      account = await server.loadAccount(keypair.publicKey());
    } else {
      throw err;
    }
  }

  const hasTrustline = account.balances.some(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
  if (hasTrustline) return account;

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: config.stellarMaxFee || StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_ASSET }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  await server.submitTransaction(tx);
  await sleep(SETTLE_MS);
  return server.loadAccount(keypair.publicKey());
}

function getUsdcBalance(account) {
  const line = account.balances.find(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );
  return line ? parseFloat(line.balance) : 0;
}

function loadHelpersFile() {
  if (!fs.existsSync(HELPERS_FILE)) {
    return { treasuryPublicKey: treasuryKeypair().publicKey(), helpers: [] };
  }
  return JSON.parse(fs.readFileSync(HELPERS_FILE, 'utf8'));
}

function saveHelpersFile(data) {
  fs.writeFileSync(HELPERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseCount(argv) {
  const idx = argv.indexOf('--count');
  if (idx === -1) return 10;
  const n = parseInt(argv[idx + 1], 10);
  if (!Number.isFinite(n) || n < 1 || n > 50) {
    throw new Error('--count must be between 1 and 50');
  }
  return n;
}

async function cmdPrepare(count) {
  const server = horizon();
  const treasury = treasuryKeypair();
  const store = loadHelpersFile();
  store.treasuryPublicKey = treasury.publicKey();
  store.createdAt = store.createdAt || new Date().toISOString();

  console.log('\n=== Prepare helper wallets ===');
  console.log(`Network:   ${config.stellar.network}`);
  console.log(`Treasury:  ${treasury.publicKey()}`);
  console.log(`USDC issuer: ${USDC_ASSET.issuer}`);
  console.log(`Creating:  ${count} helper wallet(s)\n`);

  const prepared = [];

  for (let i = 0; i < count; i++) {
    const kp = StellarSdk.Keypair.random();
    process.stdout.write(`[${i + 1}/${count}] ${kp.publicKey()} … `);
    try {
      await fundViaFriendbot(kp.publicKey());
      await sleep(SETTLE_MS);
      await ensureUsdcTrustline(kp, server);
      const entry = {
        publicKey: kp.publicKey(),
        secretKey: kp.secret(),
        preparedAt: new Date().toISOString(),
        circleFunded: false,
        swept: false,
        sweepTxHash: null,
      };
      store.helpers.push(entry);
      prepared.push(entry);
      console.log('ready (XLM + trustline)');
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
    await sleep(500);
  }

  saveHelpersFile(store);

  console.log('\n--- Fund these on Circle (manual) ---\n');
  prepared.forEach((h, i) => {
    console.log(`${i + 1}. ${h.publicKey}`);
  });

  printCircleGuide(prepared.length);

  console.log('\nAfter Circle funding, run:\n');
  console.log('  node scripts/topUpTreasuryFromCircle.mjs sweep\n');
}

function printCircleGuide(addressCount) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  CIRCLE FAUCET — do this in your browser (cannot be automated) ║
╚══════════════════════════════════════════════════════════════════╝

1. Open:  https://faucet.circle.com/

2. Asset:     USDC

3. Network:   Stellar Testnet
              (NOT Ethereum, NOT Sepolia — must be Stellar Testnet)

4. For EACH address listed above (${addressCount} total):
   a. Paste the helper G... address into "Send to" / wallet field
   b. Click "Send 20 USDC" (or "Get tokens")
   c. Wait until it succeeds (~20 USDC per address)
   d. Move to the next address

5. Limits: ~20 USDC per address; cooldown ~2 hours if you reuse the SAME address.
   New helper addresses (from prepare) can each be funded once in one session.

6. Verify (optional): https://stellar.expert/explorer/testnet
   Search helper G... → should show ~20 USDC from Circle issuer:
   ${USDC_ASSET.issuer}

7. When done, return here and run:
   node scripts/topUpTreasuryFromCircle.mjs sweep
`);
}

async function cmdSweep() {
  const server = horizon();
  const treasury = treasuryKeypair();
  const store = loadHelpersFile();

  if (!store.helpers?.length) {
    console.error('No helpers in .treasury-helpers.json — run prepare first.');
    process.exit(1);
  }

  console.log('\n=== Sweep helper USDC → treasury ===');
  console.log(`Treasury: ${treasury.publicKey()}\n`);

  let totalSwept = 0;
  let sweptCount = 0;

  for (const helper of store.helpers) {
    if (helper.swept) {
      console.log(`skip (already swept) ${helper.publicKey}`);
      continue;
    }

    const kp = StellarSdk.Keypair.fromSecret(helper.secretKey);
    let account;
    try {
      account = await server.loadAccount(kp.publicKey());
    } catch {
      console.log(`skip (no account) ${helper.publicKey}`);
      continue;
    }

    const usdc = getUsdcBalance(account);
    if (usdc < 0.0000001) {
      console.log(`wait (0 USDC) ${helper.publicKey} — fund on Circle first`);
      continue;
    }

    const amount = usdc.toFixed(7);
    process.stdout.write(`sweep ${amount} USDC from ${helper.publicKey} … `);

    try {
      const fresh = await server.loadAccount(kp.publicKey());
      const tx = new StellarSdk.TransactionBuilder(fresh, {
        fee: config.stellarMaxFee || StellarSdk.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: treasury.publicKey(),
            asset: USDC_ASSET,
            amount,
          })
        )
        .setTimeout(30)
        .build();

      tx.sign(kp);
      const result = await server.submitTransaction(tx);
      helper.swept = true;
      helper.sweepTxHash = result.hash;
      helper.sweptAmount = parseFloat(amount);
      helper.sweptAt = new Date().toISOString();
      totalSwept += parseFloat(amount);
      sweptCount += 1;
      console.log(`ok ${result.hash.slice(0, 8)}…`);
    } catch (err) {
      const codes = err?.response?.data?.extras?.result_codes;
      console.log(`FAILED: ${err.message}`);
      if (codes) console.log('  codes:', codes);
    }

    await sleep(800);
  }

  saveHelpersFile(store);

  const treasuryAccount = await server.loadAccount(treasury.publicKey());
  const treasuryUsdc = getUsdcBalance(treasuryAccount);

  console.log('\n--- Summary ---');
  console.log(`Swept this run: ${sweptCount} helper(s), ${totalSwept.toFixed(7)} USDC`);
  console.log(`Treasury balance now: ${treasuryUsdc.toFixed(7)} USDC`);
  console.log(`Explorer: https://stellar.expert/explorer/testnet/account/${treasury.publicKey()}\n`);

  const pending = store.helpers.filter((h) => !h.swept).length;
  if (pending > 0) {
    console.log(`${pending} helper(s) still pending (not funded on Circle or already swept).`);
    console.log('Run "status" to see balances, then sweep again after Circle funding.\n');
  }
}

async function cmdStatus() {
  const server = horizon();
  const treasury = treasuryKeypair();
  const store = loadHelpersFile();

  console.log('\n=== Treasury top-up status ===');
  console.log(`Network:  ${config.stellar.network}`);
  console.log(`Treasury: ${treasury.publicKey()}`);
  console.log(`Issuer:   ${USDC_ASSET.issuer}\n`);

  try {
    const tAcct = await server.loadAccount(treasury.publicKey());
    const xlm = tAcct.balances.find((b) => b.asset_type === 'native');
    const treasuryUsdc = getUsdcBalance(tAcct);
    console.log(`Treasury XLM:  ${xlm ? parseFloat(xlm.balance).toFixed(7) : 0}`);
    console.log(`Treasury USDC: ${treasuryUsdc.toFixed(7)}`);
    console.log(`Rough capacity @ 20 USDC/tester: ~${Math.floor(treasuryUsdc / 20)} new wallets`);
  } catch (err) {
    console.log(`Treasury account error: ${err.message}`);
  }

  if (!store.helpers?.length) {
    console.log('\nNo helpers file yet. Run: node scripts/topUpTreasuryFromCircle.mjs prepare --count 10\n');
    return;
  }

  console.log(`\nHelpers (${store.helpers.length} total):\n`);
  console.log('Public key                                      USDC      Status');
  console.log('─'.repeat(72));

  for (const h of store.helpers) {
    let usdc = 0;
    try {
      const acct = await server.loadAccount(h.publicKey);
      usdc = getUsdcBalance(acct);
    } catch {
      usdc = 0;
    }
    const status = h.swept ? 'swept' : usdc > 0 ? 'ready to sweep' : 'needs Circle';
    const usdcStr = usdc.toFixed(2).padStart(8);
    console.log(`${h.publicKey}  ${usdcStr}  ${status}`);
  }

  console.log('');
}

async function main() {
  const cmd = process.argv[2] || 'help';

  switch (cmd) {
    case 'prepare':
      await cmdPrepare(parseCount(process.argv));
      break;
    case 'sweep':
      await cmdSweep();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'circle-guide':
      printCircleGuide(0);
      break;
    case 'help':
    default:
      console.log(`
Rowan testnet treasury top-up (Circle USDC → helpers → treasury)

Commands:
  prepare [--count 10]   Create helper wallets (Friendbot + USDC trustline)
  circle-guide           Print Circle faucet instructions
  sweep                  Send helper USDC to treasury
  status                 Show treasury + helper balances

Workflow:
  1. node scripts/topUpTreasuryFromCircle.mjs prepare --count 10
  2. Fund each helper G... on https://faucet.circle.com (Stellar Testnet)
  3. node scripts/topUpTreasuryFromCircle.mjs sweep
  4. node scripts/topUpTreasuryFromCircle.mjs status

Repeat prepare → Circle → sweep until treasury has enough USDC.
Requires TESTNET_FAUCET_SECRET_KEY in backend/.env
`);
      break;
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
