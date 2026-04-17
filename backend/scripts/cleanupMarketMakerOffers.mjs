#!/usr/bin/env node
/**
 * Cancel all existing offers on market maker account to clear space
 * Run this if market maker account is underfunded due to offer reserves
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
};

const isTestnet = config.stellar.network === 'testnet';

async function cleanupOffers() {
  console.log('🧹 Cleaning up Market Maker Offers\n');
  
  if (!config.stellar.marketMakerPublicKey || !config.stellar.marketMakerSecretKey) {
    console.error('❌ MARKET_MAKER_PUBLIC_KEY and MARKET_MAKER_SECRET_KEY required');
    process.exit(1);
  }

  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
  const keypair = StellarSdk.Keypair.fromSecret(config.stellar.marketMakerSecretKey);

  try {
    // Load account and get offers
    console.log('📡 Loading market maker account...');
    let account = await server.loadAccount(config.stellar.marketMakerPublicKey);
    console.log(`✅ Account found\n`);

    // Get all offers
    console.log('🔍 Fetching existing offers...');
    const offersResponse = await server.offers().forAccount(config.stellar.marketMakerPublicKey).call();
    const offers = offersResponse.records;

    if (offers.length === 0) {
      console.log('✅ No offers to clean up');
      return;
    }

    console.log(`Found ${offers.length} offer(s) to cancel\n`);

    // Create transaction to cancel all offers
    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC,
    });

    // Add manageSellOffer with amount 0 to cancel each offer
    for (const offer of offers) {
      console.log(`  Canceling offer ${offer.id}...`);
      
      // Reconstruct assets from offer data
      const sellingAsset = offer.selling.asset_type === 'native'
        ? StellarSdk.Asset.native()
        : new StellarSdk.Asset(offer.selling.asset_code, offer.selling.asset_issuer);
        
      const buyingAsset = offer.buying.asset_type === 'native'
        ? StellarSdk.Asset.native()
        : new StellarSdk.Asset(offer.buying.asset_code, offer.buying.asset_issuer);
      
      txBuilder.addOperation(
        StellarSdk.Operation.manageSellOffer({
          selling: sellingAsset,
          buying: buyingAsset,
          amount: '0',  // Amount 0 = cancel offer
          price: '1',   // Price doesn't matter when canceling
          offerId: offer.id.toString(),
        })
      );
    }

    txBuilder.setTimeout(30);
    const tx = txBuilder.build();
    tx.sign(keypair);

    console.log('\n📡 Submitting cancellations...');
    const result = await server.submitTransaction(tx);
    console.log(`✅ Offers canceled!\nTransaction hash: ${result.hash}\n`);

    // Verify
    console.log('🔍 Verifying...');
    const newOffers = await server.offers().forAccount(config.stellar.marketMakerPublicKey).call();
    console.log(`✅ Market maker now has ${newOffers.records.length} active offer(s)`);
    
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    if (err.response?.data?.extras?.result_codes) {
      console.error('Transaction codes:', err.response.data.extras.result_codes);
    }
    process.exit(1);
  }
}

cleanupOffers();
