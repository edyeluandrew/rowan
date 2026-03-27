/**
 * MARKET MAKER SETUP FOR STELLAR TESTNET
 * 
 * Creates persistent liquidity on the XLM/USDC pair by:
 * 1. Reusing a single market maker account (loads from env or generates new)
 * 2. Creating multiple staggered offers at different price levels
 * 3. Building both sides of the market (XLM→USDC and USDC→XLM)
 * 4. Verifying offers persist on Horizon
 * 
 * Usage:
 *   node setupMarketMaker.js
 * 
 * Output:
 *   - Market maker public key (save this)
 *   - Market maker secret key (SAVE THIS SECURELY in .env as MARKET_MAKER_SECRET_KEY)
 *   - Active offers created
 *   - Verification results
 */

import dotenv from 'dotenv';
dotenv.config();

import StellarSdk from '@stellar/stellar-sdk';

// ─── CONFIGURATION ──────────────────────────────────────────
const NETWORK = 'testnet';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const networkPassphrase = 'Test SDF Network ; September 2015'; // Testnet passphrase

// USDC on testnet
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ASSET = new StellarSdk.Asset('USDC', USDC_ISSUER);
const XLM_ASSET = StellarSdk.Asset.native();

// Market maker account
let marketMakerKeypair;
let marketMakerPublicKey;

// ─── LOGGING HELPERS ────────────────────────────────────────
function log(msg) {
  console.log(`[MM] ${msg}`);
}

function logOk(msg) {
  console.log(`[MM] ✅ ${msg}`);
}

function logErr(msg) {
  console.error(`[MM] ❌ ${msg}`);
}

function logWarn(msg) {
  console.warn(`[MM] ⚠️  ${msg}`);
}

function success(msg) {
  console.log(`[MM] ✅ ${msg}`);
}

function warn(msg) {
  console.warn(`[MM] ⚠️  ${msg}`);
}

function error(msg) {
  console.error(`[MM] ❌ ${msg}`);
}

// ─── STEP 1: INITIALIZE MARKET MAKER ACCOUNT ────────────────
async function initializeMarketMaker() {
  log('='.repeat(60));
  log('STEP 1: Initialize Market Maker Account');
  log('='.repeat(60));

  const existingSecret = process.env.MARKET_MAKER_SECRET_KEY;

  if (existingSecret) {
    // Load existing account
    try {
      marketMakerKeypair = StellarSdk.Keypair.fromSecret(existingSecret);
      marketMakerPublicKey = marketMakerKeypair.publicKey();
      log(`Loaded existing market maker: ${marketMakerPublicKey}`);

      // Verify it exists on testnet
      try {
        const account = await server.loadAccount(marketMakerPublicKey);
        logOk(`Account verified on testnet (balance: ${account.balances[0].balance} XLM)`);
        return;
      } catch (err) {
        logErr(`Existing account not found on testnet: ${err.message}`);
        logErr('Generating new account...');
      }
    } catch (err) {
      logErr(`Invalid MARKET_MAKER_SECRET_KEY in env: ${err.message}`);
    }
  }

  // Generate new account
  marketMakerKeypair = StellarSdk.Keypair.random();
  marketMakerPublicKey = marketMakerKeypair.publicKey();

  log(`Generated new market maker keypair:`);
  log(`  Public: ${marketMakerPublicKey}`);
  log(`  Secret: ${marketMakerKeypair.secret()}`);
  logWarn(`SAVE THE SECRET KEY! Add to .env as MARKET_MAKER_SECRET_KEY`);

  // Fund via Friendbot
  log(`\nFunding via Friendbot...`);
  try {
    const friendbotUrl = `${FRIENDBOT_URL}?addr=${marketMakerPublicKey}`;
    const response = await fetch(friendbotUrl);
    const data = await response.json();

    if (response.ok) {
      success(`Friendbot funded account with 10,000 XLM`);
      log(`  Transaction: ${data.hash}`);
    } else {
      throw new Error(data.detail || 'Unknown error');
    }
  } catch (err) {
    error(`Friendbot failed: ${err.message}`);
    throw err;
  }
}

// ─── STEP 2: CHECK BALANCES ────────────────────────────────
async function checkBalances() {
  log('='.repeat(60));
  log('STEP 2: Check Account Balances');
  log('='.repeat(60));

  const account = await server.loadAccount(marketMakerPublicKey);

  const xlmBalance = account.balances.find(b => b.asset_type === 'native');
  const usdcBalance = account.balances.find(b => b.asset_code === 'USDC');

  log(`XLM Balance: ${xlmBalance?.balance || '0'} XLM`);
  log(`USDC Balance: ${usdcBalance?.balance || '0'} USDC`);

  return {
    xlm: parseFloat(xlmBalance?.balance || '0'),
    usdc: parseFloat(usdcBalance?.balance || '0'),
    account,
  };
}

// ─── STEP 3: ADD USDC TRUSTLINE ────────────────────────────
async function addUsdcTrustline(account) {
  log('='.repeat(60));
  log('STEP 3: Add USDC Trustline');
  log('='.repeat(60));

  // Check if trustline exists
  const hasTrustline = account.balances.some(b => b.asset_code === 'USDC');

  if (hasTrustline) {
    logOk(`USDC trustline already exists`);
    return;
  }

  log(`Creating USDC trustline...`);

  const freshAccount = await server.loadAccount(marketMakerPublicKey);
  const tx = new StellarSdk.TransactionBuilder(freshAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: USDC_ASSET,
        limit: '1000000', // 1M USDC limit
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(marketMakerKeypair);
  const result = await server.submitTransaction(tx);

  logOk(`USDC trustline created`);
  log(`  Hash: ${result.hash}`);
}

// ─── STEP 3.5: ACQUIRE USDC ────────────────────────────────
async function acquireUsdc(currentUsdcBalance) {
  log('='.repeat(60));
  log('STEP 3.5: Acquire USDC via Path Payment');
  log('='.repeat(60));

  if (currentUsdcBalance >= 100) {
    logOk(`USDC balance sufficient (${currentUsdcBalance} USDC)`);
    return;
  }

  log(`Current USDC balance (${currentUsdcBalance}) is below 100. Attempting path payment...`);

  try {
    const freshAccount = await server.loadAccount(marketMakerPublicKey);
    const tx = new StellarSdk.TransactionBuilder(freshAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.pathPaymentStrictSend({
          sendAsset: XLM_ASSET,
          sendAmount: '600',
          destination: marketMakerPublicKey,
          destAsset: USDC_ASSET,
          destMin: '0.0000001',
          path: [],
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(marketMakerKeypair);
    const result = await server.submitTransaction(tx);

    logOk(`Path payment succeeded`);
    log(`  Hash: ${result.hash}`);
  } catch (err) {
    logWarn(`Path payment failed: no route available (${err.message})`);
    logWarn(`Please manually fund USDC at: https://ultrastellar.com/faucet`);
    logWarn(`Then re-run this script`);
  }
}

// ─── STEP 4: CREATE STAGGERED OFFERS ────────────────────────
async function createStaggeredOffers(xlmBalance, usdcBalance) {
  log('='.repeat(60));
  log('STEP 4: Create Staggered Offers');
  log('='.repeat(60));

  // ─── TRANSACTION 1-3: CREATE 3 XLM→USDC OFFERS (ONE PER TRANSACTION) ────
  if (xlmBalance > 1000) {
    log('Creating 3 XLM→USDC offers (one per transaction)...');
    
    const offers1 = [
      { amount: '2000', price: '0.20', desc: 'Offer 1' },
      { amount: '2000', price: '0.18', desc: 'Offer 2' },
      { amount: '2000', price: '0.15', desc: 'Offer 3' },
    ];
    
    for (const offer of offers1) {
      try {
        const acct = await server.loadAccount(marketMakerPublicKey);
        const bldr = new StellarSdk.TransactionBuilder(acct, {
          fee: (parseInt(StellarSdk.BASE_FEE) * 2).toString(),
          networkPassphrase,
        });
        
        bldr.addOperation(
          StellarSdk.Operation.manageSellOffer({
            selling: XLM_ASSET,
            buying: USDC_ASSET,
            amount: offer.amount,
            price: offer.price,
            offerId: '0',
          })
        );
        log(`  ${offer.desc}: Sell ${offer.amount} XLM @ ${offer.price} USDC/XLM`);
        
        const tx = bldr.setTimeout(30).build();
        tx.sign(marketMakerKeypair);
        const res = await server.submitTransaction(tx);
        logOk(`  ✓ Created (${res.hash.slice(0, 8)}...)`);
        
        // Longer delay between offers
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        logErr(`  ✗ Failed: ${err.message}`);
        // Don't rethrow - continue with next offer
        logWarn(`  Continuing with next offer...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } else {
    logWarn(`Insufficient XLM balance (${xlmBalance})`);
  }

  // ─── TRANSACTION 4-6: CREATE 3 USDC→XLM OFFERS (ONE PER TRANSACTION) ────
  if (usdcBalance >= 100) {
    log('\nCreating 3 USDC→XLM offers (one per transaction)...');
    
    const offers2 = [
      { amount: '200', price: '5.00', desc: 'Offer 4' },
      { amount: '200', price: '5.56', desc: 'Offer 5' },
      { amount: '200', price: '6.67', desc: 'Offer 6' },
    ];
    
    for (const offer of offers2) {
      try {
        const acct = await server.loadAccount(marketMakerPublicKey);
        const bldr = new StellarSdk.TransactionBuilder(acct, {
          fee: (parseInt(StellarSdk.BASE_FEE) * 2).toString(),
          networkPassphrase,
        });
        
        bldr.addOperation(
          StellarSdk.Operation.manageSellOffer({
            selling: USDC_ASSET,
            buying: XLM_ASSET,
            amount: offer.amount,
            price: offer.price,
            offerId: '0',
          })
        );
        log(`  ${offer.desc}: Sell ${offer.amount} USDC @ ${offer.price} XLM/USDC`);
        
        const tx = bldr.setTimeout(30).build();
        tx.sign(marketMakerKeypair);
        const res = await server.submitTransaction(tx);
        logOk(`  ✓ Created (${res.hash.slice(0, 8)}...)`);
        
        // Longer delay between offers
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        logErr(`  ✗ Failed: ${err.message}`);
        // Don't rethrow - continue with next offer
        logWarn(`  Continuing with next offer...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } else {
    logWarn(`Insufficient USDC balance (${usdcBalance})`);
  }
}

// ─── STEP 5: VERIFY OFFERS PERSIST ─────────────────────────
async function verifyOffers() {
  log('='.repeat(60));
  log('STEP 5: Verify Offers Persist on Horizon');
  log('='.repeat(60));

  // Wait briefly for Horizon to index
  log('Waiting 3 seconds for Horizon to index...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Query offers
  const offersResponse = await server
    .offers()
    .forAccount(marketMakerPublicKey)
    .call();

  const offers = offersResponse.records || [];

  if (offers.length === 0) {
    error('No active offers found on Horizon!');
    error('This suggests offers were matched or cancelled immediately.');
    return false;
  }

  success(`${offers.length} active offers found on Horizon`);

  // Group by pair
  const xlmUsdcOffers = offers.filter(
    o => o.selling.asset_type === 'native' && o.buying.asset_code === 'USDC'
  );

  const usdcXlmOffers = offers.filter(
    o => o.selling.asset_code === 'USDC' && o.buying.asset_type === 'native'
  );

  log(`\n  XLM→USDC offers: ${xlmUsdcOffers.length}`);
  xlmUsdcOffers.forEach((o, i) => {
    log(`    ${i + 1}. Sell ${o.amount} XLM @ ${o.price} USDC/XLM (ID: ${o.id})`);
  });

  log(`\n  USDC→XLM offers: ${usdcXlmOffers.length}`);
  usdcXlmOffers.forEach((o, i) => {
    log(`    ${i + 1}. Sell ${o.amount} USDC @ ${o.price} XLM/USDC (ID: ${o.id})`);
  });

  return offers.length > 0;
}

// ─── MAIN EXECUTION ────────────────────────────────────────
async function main() {
  try {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     STELLAR TESTNET MARKET MAKER SETUP                     ║');
    console.log('║     XLM/USDC Liquidity Provisioning                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Step 1: Initialize
    await initializeMarketMaker();

    // Step 2: Check balances
    const { xlm, usdc, account } = await checkBalances();

    // Step 3: Add USDC trustline
    await addUsdcTrustline(account);

    // Refresh balances after trustline
    const balances1 = await checkBalances();

    // Step 3.5: Acquire USDC
    await acquireUsdc(balances1.usdc);

    // Refresh balances after USDC acquisition
    const balances2 = await checkBalances();

    // Step 4: Create offers
    await createStaggeredOffers(balances2.xlm, balances2.usdc);

    // Step 5: Verify
    const offersVerified = await verifyOffers();

    // ─── FINAL SUMMARY ────────────────────────────────────────
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     SETUP COMPLETE                                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    log(`Market Maker Public Key: ${marketMakerPublicKey}`);
    log(`Market Maker Secret Key: ${marketMakerKeypair.secret()}`);
    log(`\n⚠️  IMPORTANT: Save the secret key in your .env file:`);
    log(`MARKET_MAKER_SECRET_KEY=${marketMakerKeypair.secret()}\n`);

    if (offersVerified) {
      logOk('Market maker is ready! Offers are persistent on Horizon.');
    } else {
      logWarn('Could not verify offers. Check Horizon manually.');
      logWarn(`View offers at: ${HORIZON_URL}/accounts/${marketMakerPublicKey}/offers`);
    }

    console.log('\n');
  } catch (err) {
    error(`Fatal error: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();
