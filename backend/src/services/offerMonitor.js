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
    console.warn('[Offer Monitor] ⚠️  Market maker not configured, skipping');
    return;
  }

  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
  const keypair = StellarSdk.Keypair.fromSecret(config.stellar.marketMakerSecretKey);

  try {
    // Check if offers exist
    const offersResponse = await server.offers().forAccount(config.stellar.marketMakerPublicKey).call();
    const activeOffers = offersResponse.records.filter(o => {
      const sellingIsNative = o.selling.asset_type === 'native';
      const buyingIsUsdc = o.buying.asset_code === 'USDC' && o.buying.asset_issuer === USDC_ASSET.issuer;
      return sellingIsNative && buyingIsUsdc;
    });

    console.log(`[Offer Monitor] Found ${activeOffers.length} active XLM→USDC offer(s)`);

    if (activeOffers.length > 0) {
      console.log('[Offer Monitor] ✅ Offers exist, no action needed\n');
      return;
    }

    console.log('[Offer Monitor] ⚠️  No XLM→USDC offers found! Recreating...\n');

    // Load account
    let account = await server.loadAccount(config.stellar.marketMakerPublicKey);

    // Create offer
    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC,
    });

    // Get XLM balance
    const xlmBalance = account.balances.find(b => !b.asset_code);
    const usableXLM = xlmBalance ? parseFloat(xlmBalance.balance) - 200 : 1000;
    const sellAmount = Math.min(500, Math.floor(usableXLM) - 10).toFixed(2);

    const xlmUsdRate = 0.273;
    const sellOfferPrice = xlmUsdRate.toFixed(7);

    console.log(`[Offer Monitor] Creating offer: Sell ${sellAmount} XLM @ ${sellOfferPrice} USDC/XLM`);

    txBuilder.addOperation(
      StellarSdk.Operation.manageSellOffer({
        selling: XLM_ASSET,
        buying: USDC_ASSET,
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
