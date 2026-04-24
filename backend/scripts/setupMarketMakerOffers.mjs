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
    
    // [DIRECTION FIX] Escrow does pathPaymentStrictReceive (sends XLM, receives USDC).
    // For that to cross, the MM must offer the OPPOSITE side: sell USDC, buy XLM.
    // Old code created sell-XLM/buy-USDC which never crossed with escrow.
    const xlmUsdRate = 0.273; // USDC per 1 XLM (rough testnet calibration)

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC,
    });

    // Get USDC balance to size the sell offer
    const usdcBalance = account.balances.find(b => b.asset_code === 'USDC' && b.asset_issuer === usdcIssuer);
    if (!usdcBalance || parseFloat(usdcBalance.balance) <= 0) {
      console.error('\n❌ Market maker has no USDC balance — fund it before creating offers.');
      console.error('   Mint testnet USDC to:', config.stellar.marketMakerPublicKey);
      process.exit(1);
    }
    const usableUSDC = Math.max(0, parseFloat(usdcBalance.balance) - 1); // 1 USDC buffer

    // price = buying / selling = XLM per USDC. At ~0.273 USD/XLM, 1 USDC ≈ 3.663 XLM.
    const sellOfferPrice = (1 / xlmUsdRate).toFixed(7);
    const sellAmount = Math.min(100, usableUSDC).toFixed(2);

    console.log(`  Creating sell offer: ${sellAmount} USDC @ ${sellOfferPrice} XLM/USDC`);

    txBuilder.addOperation(
      StellarSdk.Operation.manageSellOffer({
        selling: USDC_ASSET,      // I'm selling USDC
        buying: XLM_ASSET,        // To buy XLM
        amount: sellAmount,       // Sell up to this much USDC
        price: sellOfferPrice,    // At this price (XLM per USDC)
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
