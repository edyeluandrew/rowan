#!/usr/bin/env node
/**
 * Monitor and restore market maker offers on startup if missing
 * This runs as part of backend initialization to ensure offers always exist
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
}

const config = {
  stellar: {
    network: process.env.STELLAR_NETWORK || 'testnet',
    horizonUrl: process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org',
    marketMakerPublicKey: process.env.MARKET_MAKER_PUBLIC_KEY,
    marketMakerSecretKey: process.env.MARKET_MAKER_SECRET_KEY,
  },
  usdcIssuerTestnet: process.env.USDC_ISSUER_TESTNET || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
};

const isTestnet = config.stellar.network === 'testnet';
const USDC_ASSET = new StellarSdk.Asset('USDC', config.usdcIssuerTestnet);
const XLM_ASSET = StellarSdk.Asset.native();

async function ensureMarketMakerOffers() {
  console.log('[Offer Monitor] Checking market maker offers on startup...\n');
  
  if (!config.stellar.marketMakerPublicKey || !config.stellar.marketMakerSecretKey) {
    console.warn('[Offer Monitor] ⚠️  Market maker not configured:');
    if (!config.stellar.marketMakerPublicKey) {
      console.warn('[Offer Monitor]   ❌ MARKET_MAKER_PUBLIC_KEY is missing');
    }
    if (!config.stellar.marketMakerSecretKey) {
      console.warn('[Offer Monitor]   ❌ MARKET_MAKER_SECRET_KEY is missing');
    }
    console.warn('[Offer Monitor]   Add these to your Render environment variables and redeploy');
    return;
  }

  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
  const keypair = StellarSdk.Keypair.fromSecret(config.stellar.marketMakerSecretKey);

  try {
    // Check if offers exist
    // [DIRECTION FIX] Escrow does pathPaymentStrictReceive (sends XLM, receives USDC).
    // To cross that order, the market maker must SELL USDC and BUY XLM — i.e.
    // the OPPOSITE side of the book. Old code looked for selling=XLM/buying=USDC,
    // which would never cross with escrow and produced empty /paths/strict-receive.
    const offersResponse = await server.offers().forAccount(config.stellar.marketMakerPublicKey).call();
    const activeOffers = offersResponse.records.filter(o => {
      const sellingIsUsdc = o.selling.asset_code === 'USDC' && o.selling.asset_issuer === USDC_ASSET.issuer;
      const buyingIsNative = o.buying.asset_type === 'native';
      return sellingIsUsdc && buyingIsNative;
    });

    console.log(`[Offer Monitor] Found ${activeOffers.length} active USDC→XLM offer(s)`);

    if (activeOffers.length > 0) {
      console.log('[Offer Monitor] ✅ Offers exist, no action needed\n');
      return;
    }

    console.log('[Offer Monitor] ⚠️  No USDC→XLM offers found! Recreating...\n');

    // Load account
    let account = await server.loadAccount(config.stellar.marketMakerPublicKey);

    // Create offer
    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC,
    });

    // [DIRECTION FIX] MM sells USDC and buys XLM — the side escrow's path payment
    // can actually consume. Need a USDC balance for this; if missing, log and bail.
    const usdcBalance = account.balances.find(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ASSET.issuer);
    if (!usdcBalance) {
      console.warn('[Offer Monitor] ❌ Market maker has no USDC trustline/balance — cannot create USDC→XLM offer');
      console.warn('[Offer Monitor]    Run: node backend/scripts/setupMarketMakerOffers.mjs to provision');
      return;
    }
    const usableUSDC = Math.max(0, parseFloat(usdcBalance.balance) - 1); // 1 USDC buffer
    if (usableUSDC <= 0) {
      console.warn(`[Offer Monitor] ❌ Market maker USDC balance too low: ${usdcBalance.balance}`);
      return;
    }
    const sellAmount = Math.min(100, usableUSDC).toFixed(2); // sell up to 100 USDC

    // price = buying / selling = XLM per USDC. At ~0.273 USD/XLM, 1 USDC ≈ 3.663 XLM.
    const xlmUsdRate = 0.273;
    const sellOfferPrice = (1 / xlmUsdRate).toFixed(7);

    console.log(`[Offer Monitor] Creating offer: Sell ${sellAmount} USDC @ ${sellOfferPrice} XLM/USDC`);

    txBuilder.addOperation(
      StellarSdk.Operation.manageSellOffer({
        selling: USDC_ASSET,   // MM gives USDC
        buying: XLM_ASSET,     // MM takes XLM
        amount: sellAmount,
        price: sellOfferPrice,
        offerId: '0',
      })
    );

    txBuilder.setTimeout(30);
    const tx = txBuilder.build();
    tx.sign(keypair);

    const result = await server.submitTransaction(tx);
    console.log(`[Offer Monitor] ✅ Offer created! TX: ${result.hash}\n`);

  } catch (err) {
    console.error(`[Offer Monitor] ❌ Error: ${err.message}`);
    if (err.response?.data?.extras?.result_codes) {
      console.error('Result codes:', err.response.data.extras.result_codes);
    }
    // Don't exit - continue running even if this fails
  }
}

// Run on import
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureMarketMakerOffers().catch(console.error);
}

export default ensureMarketMakerOffers;
