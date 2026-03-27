#!/usr/bin/env node
/**
 * Setup XLM/USDC liquidity on Stellar testnet DEX.
 * Creates a market maker account with buy/sell offers for USDC/XLM trading.
 * 
 * This script must be run ONCE on testnet. The offers persist on the blockchain
 * and will survive server restarts/redeployments.
 * 
 * Usage: node scripts/setupTestnetLiquidity.js
 */
import dotenv from 'dotenv';
dotenv.config();

import StellarSdk from '@stellar/stellar-sdk';
import config from '../src/config/index.js';

const MARKET_MAKER_SEED = process.env.MARKET_MAKER_SECRET_KEY;
const EXCHANGE_RATE = 0.10; // 1 XLM = 0.10 USDC

async function main() {
  const network = config.stellar.network;
  
  // Only run on testnet
  if (network !== 'testnet') {
    console.error('⚠️  This script is for TESTNET ONLY. Current network:', network);
    process.exit(1);
  }

  const horizonUrl = config.stellar.horizonUrl;
  const server = new StellarSdk.Horizon.Server(horizonUrl);
  const usdcIssuer = config.usdcIssuerTestnet;
  const usdcAsset = new StellarSdk.Asset('USDC', usdcIssuer);
  const xlmAsset = StellarSdk.Asset.native();
  const networkPassphrase = StellarSdk.Networks.TESTNET;

  console.log('🚀 Setting up testnet liquidity...');
  console.log('   Network:', network);
  console.log('   Horizon:', horizonUrl);
  console.log('   USDC Issuera:', usdcIssuer);
  console.log('   Exchange Rate: 1 XLM = ', EXCHANGE_RATE, 'USDC\n');

  // Step 1: Get or create market maker keypair
  let marketMakerKeypair;
  if (process.env.MARKET_MAKER_SECRET_KEY) {
    console.log('📌 Using market maker from MARKET_MAKER_SECRET_KEY...');
    marketMakerKeypair = StellarSdk.Keypair.fromSecret(process.env.MARKET_MAKER_SECRET_KEY);
  } else {
    console.log('📌 Generating new market maker keypair...');
    marketMakerKeypair = StellarSdk.Keypair.random();
    console.log('   ⚠️  Save this for next time: MARKET_MAKER_SECRET_KEY=' + marketMakerKeypair.secret());
  }

  const marketMakerPub = marketMakerKeypair.publicKey();
  console.log('   Public Key:', marketMakerPub + '\n');

  // Step 2: Fund account via Friendbot (testnet only)
  console.log('💰 Funding market maker via Friendbot...');
  try {
    const response = await fetch(`https://friendbot.stellar.org/?addr=${marketMakerPub}`);
    if (!response.ok) {
      throw new Error(`Friendbot failed: ${response.statusText}`);
    }
    console.log('   ✅ Funded 10,000 XLM\n');
  } catch (err) {
    console.error('   ❌ Friendbot error:', err.message);
    // Account might already be funded, try to continue
  }

  // Step 3: Load account and check USDC trustline
  console.log('📊 Loading market maker account...');
  let account = await server.loadAccount(marketMakerPub);
  console.log('   Sequence:', account.sequence);
  console.log('   Balances:', account.balances.length);

  const hasUsdcTrustline = account.balances.some(
    (b) => b.asset_code === 'USDC' && b.asset_issuer === usdcIssuer
  );

  // Step 4: Add USDC trustline if needed
  if (!hasUsdcTrustline) {
    console.log('🔗 Adding USDC trustline...');
    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    });
    txBuilder.addOperation(StellarSdk.Operation.changeTrust({ asset: usdcAsset }));
    txBuilder.setTimeout(30);
    const tx = txBuilder.build();
    tx.sign(marketMakerKeypair);

    try {
      const result = await server.submitTransaction(tx);
      console.log('   ✅ Trustline created. Hash:', result.hash + '\n');
      // Reload account after trustline change
      account = await server.loadAccount(marketMakerPub);
    } catch (err) {
      console.error('   ❌ Failed to create trustline:', err.message);
      process.exit(1);
    }
  } else {
    console.log('   ✅ USDC trustline already exists\n');
  }

  // Step 5: Create DEX offers
  console.log('🎯 Creating DEX offers...');

  // We can only create a buy offer now (sell XLM for USDC)
  // since the account doesn't have USDC yet to create a sell offer.
  // The buy offer is what enables the pathPaymentStrictReceive swap to work.
  
  // Use conservative amounts to avoid hitting XLM balance limits
  const buySellAmount = '100'; // Buy up to 100 USDC per offer
  const buyXlmAmount = '1000'; // Sell 1000 XLM (safer with fees)

  // Price for buy offer: amount of receiving asset per unit of selling asset
  // Buy offer: sell XLM (native), receive USDC → price = USDC/XLM = 0.10
  const buyPrice = {
    n: 1,
    d: 10
  }; // Exact fraction: 1/10 = 0.1

  const txBuilder = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  });

  // Buy offer: Market maker buys USDC with XLM
  // This offer enables: "I'll sell you XLM for USDC"
  // Price: 1/10 = 0.1 USDC per XLM
  // Use string representation of decimal price
  const price = '0.1';
  
  console.log('   Price for offer:', price);
  
  txBuilder.addOperation(
    StellarSdk.Operation.manageSellOffer({
      selling: xlmAsset,
      buying: usdcAsset,
      amount: buyXlmAmount,
      price: price,
      offerId: 0, // 0 = create new offer
    })
  );

  txBuilder.setTimeout(30);
  const tx = txBuilder.build();
  tx.sign(marketMakerKeypair);

  try {
    const result = await server.submitTransaction(tx);
    console.log('   ✅ Buy offer created successfully!\n');
    console.log('   Transaction Hash:', result.hash);
    console.log('   Market Maker Offer: Sell', buyXlmAmount, 'XLM → Get', buySellAmount, 'USDC\n');
  } catch (err) {
    console.error('   ❌ Failed to create offers:', err.message);
    if (err.response?.data?.extras?.result_codes?.operations) {
      console.error('   Operation codes:', err.response.data.extras.result_codes.operations);
    }
    if (err.response?.data?.extras) {
      console.error('   Full error extras:', JSON.stringify(err.response.data.extras, null, 2));
    }
    process.exit(1);
  }

  // Step 6: Verify offers
  console.log('🔍 Verifying offers on DEX...');
  try {
    const offers = await server.offers()
      .forAccount(marketMakerPub)
      .call();
    
    console.log(`   ✅ Found ${offers.records.length} active offer(s):`);
    offers.records.forEach((offer, i) => {
      console.log(`   Offer ${i + 1}: Selling ${offer.selling.asset_code || 'XLM'} → Buying ${offer.buying.asset_code}. Amount: ${offer.amount}`);
    });
  } catch (err) {
    console.error('   ⚠️  Could not verify offers:', err.message);
  }

  console.log('\n✨ Testnet liquidity setup complete!');
  console.log('   Market maker is now providing XLM/USDC liquidity on the DEX.');
  console.log('   The pathPaymentStrictReceive swap should now work.\n');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
