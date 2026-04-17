#!/usr/bin/env node
/**
 * Create XLM→USDC trading offers on the market maker account
 * This enables Horizon path discovery for quote generation
 * 
 * Usage: node scripts/setupMarketMakerOffers.mjs
 */

import dotenv from 'dotenv';
import * as StellarSdk from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✓ Loaded .env from ${envPath}\n`);
}

const config = {
  stellar: {
    network: process.env.STELLAR_NETWORK || 'testnet',
    horizonUrl: process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org',
    marketMakerPublicKey: process.env.MARKET_MAKER_PUBLIC_KEY,
    marketMakerSecretKey: process.env.MARKET_MAKER_SECRET_KEY,
  },
  usdcIssuerTestnet: process.env.USDC_ISSUER_TESTNET || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  usdcIssuerMainnet: process.env.USDC_ISSUER_MAINNET || 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  usdcFiatRates: {
    UGX: parseFloat(process.env.USDC_RATE_UGX) || 3750,
    KES: parseFloat(process.env.USDC_RATE_KES) || 153,
    TZS: parseFloat(process.env.USDC_RATE_TZS) || 2650,
  },
};

const isTestnet = config.stellar.network === 'testnet';
const usdcIssuer = isTestnet ? config.usdcIssuerTestnet : config.usdcIssuerMainnet;
const USDC_ASSET = new StellarSdk.Asset('USDC', usdcIssuer);
const XLM_ASSET = StellarSdk.Asset.native();

async function createOffers() {
  console.log('📊 Setting up Market Maker Offers\n');
  
  if (!config.stellar.marketMakerPublicKey || !config.stellar.marketMakerSecretKey) {
    console.error('❌ MARKET_MAKER_PUBLIC_KEY and MARKET_MAKER_SECRET_KEY required');
    process.exit(1);
  }

  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
  const keypair = StellarSdk.Keypair.fromSecret(config.stellar.marketMakerSecretKey);

  try {
    // Load account
    console.log('📡 Loading market maker account...');
    let account = await server.loadAccount(config.stellar.marketMakerPublicKey);
    console.log(`✅ Account found: ${config.stellar.marketMakerPublicKey}`);

    // Check balances
    console.log('\n💰 Current Balances:');
    account.balances.forEach((b) => {
      const code = b.asset_code || 'XLM';
      console.log(`  - ${code}: ${b.balance}`);
    });

    // Check USDC trustline
    const hasUsdcTrustline = account.balances.some(
      (b) => b.asset_code === 'USDC' && b.asset_issuer === usdcIssuer
    );
    if (!hasUsdcTrustline) {
      console.log('\n⚠️  USDC trustline not found. Creating...');
      // Create trustline first
      let txBuilder = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC,
      });
      txBuilder.addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_ASSET }));
      txBuilder.setTimeout(30);
      let tx = txBuilder.build();
      tx.sign(keypair);
      await server.submitTransaction(tx);
      console.log('✅ Trustline created');
      // Reload account with new sequence number
      account = await server.loadAccount(config.stellar.marketMakerPublicKey);
    }

    // Create offers
    console.log('\n📋 Creating trading offers...');
    
    // Calculate prices from config
    // USDC/UGX rate tells us USDC value. We need XLM/USDC price.
    // Assume 1 XLM ≈ 0.273 USD, and build from there
    const xlmUsdRate = 0.273;
    const usdcToUgx = config.usdcFiatRates.UGX;
    const xlmToUgx = xlmUsdRate * usdcToUgx;
    const xlmUsdcPrice = xlmUsdRate; // How much USDC you get per 1 XLM (roughly)

    console.log(`  Calculated XLM/USDC rate: ~${xlmUsdcPrice.toFixed(4)}`);

    // Create a buy offer: selling USDC to get XLM
    // This means: "I'll sell USDC if you give me XLM at this price"
    // Price = how much USDC I want per 1 XLM I give
    const buyOfferPrice = (1 / xlmUsdcPrice).toFixed(7); // USDC per XLM

    console.log(`  Buy offer price (USDC per XLM): ${buyOfferPrice}`);

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC,
    });

    // Get actual USDC balance to size the buy offer properly
    const usdcBalance = account.balances.find(b => b.asset_code === 'USDC' && b.asset_issuer === usdcIssuer);
    const usableUSDC = usdcBalance ? parseFloat(usdcBalance.balance) * 0.9 : 500; // Leave 10% buffer

    // Add buy offer: I'm willing to buy XLM (sell USDC for it)
    txBuilder.addOperation(
      StellarSdk.Operation.manageBuyOffer({
        selling: USDC_ASSET,      // I'm selling USDC
        buying: XLM_ASSET,        // To buy XLM
        buyAmount: Math.min(1000, usableUSDC / parseFloat(buyOfferPrice)).toFixed(2), // Don't exceed available USDC
        price: buyOfferPrice,     // At this price (USDC per XLM)
        offerId: '0',             // New offer (offerId 0 = create)
      })
    );

    // Also add a sell offer for completeness
    // Sell offer: "I'll sell XLM if you give me USDC at this price"
    const xlmBalance = account.balances.find(b => !b.asset_code);
    const usableXLM = xlmBalance ? parseFloat(xlmBalance.balance) * 0.8 : 1000; // Leave buffer for fees

    const sellOfferPrice = xlmUsdcPrice.toFixed(7); // How much USDC per 1 XLM

    txBuilder.addOperation(
      StellarSdk.Operation.manageSellOffer({
        selling: XLM_ASSET,       // I'm selling XLM
        buying: USDC_ASSET,       // To buy USDC
        amount: Math.min(5000, usableXLM).toFixed(2), // Sell reasonable amount
        price: sellOfferPrice,    // At this price (in USDC per XLM)
        offerId: '0',             // New offer
      })
    );

    txBuilder.setTimeout(30);
    const tx = txBuilder.build();
    tx.sign(keypair);

    console.log('\n📡 Submitting offers...');
    const result = await server.submitTransaction(tx);
    console.log(`✅ Offers created successfully!`);
    console.log(`Transaction hash: ${result.hash}\n`);

    // Verify
    console.log('🔍 Verifying offers...');
    const offers = await server.offers().forAccount(config.stellar.marketMakerPublicKey).call();
    console.log(`✅ Market maker now has ${offers.records.length} active offer(s)\n`);
    offers.records.forEach((offer, idx) => {
      const selling = offer.selling.asset_code || 'XLM';
      const buying = offer.buying.asset_code || 'XLM';
      console.log(`  Offer ${idx + 1}: Sell ${offer.amount} ${selling} → Buy ${selling} @ ${offer.price} ${buying}/${selling}`);
    });

    console.log('\n✅ Setup complete! Path discovery should now work.');
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    if (err.response?.data?.extras?.result_codes) {
      console.error('Transaction codes:', err.response.data.extras.result_codes);
    }
    process.exit(1);
  }
}

createOffers();
