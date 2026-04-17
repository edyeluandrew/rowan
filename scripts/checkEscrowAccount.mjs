#!/usr/bin/env node
/**
 * Diagnostic script to check escrow account status on Stellar
 * Usage: node scripts/checkEscrowAccount.mjs
 */

import dotenv from 'dotenv';
import * as StellarSdk from '@stellar/stellar-sdk';

dotenv.config();

const config = {
  stellar: {
    network: process.env.STELLAR_NETWORK || 'testnet',
    horizonUrl: process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org',
    escrowPublicKey: process.env.ESCROW_PUBLIC_KEY,
    escrowSecretKey: process.env.ESCROW_SECRET_KEY,
  },
  usdcIssuerTestnet: process.env.USDC_ISSUER_TESTNET || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  usdcIssuerMainnet: process.env.USDC_ISSUER_MAINNET || 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
};

const isTestnet = config.stellar.network === 'testnet';
const usdcIssuer = isTestnet ? config.usdcIssuerTestnet : config.usdcIssuerMainnet;
const USDC_ASSET = new StellarSdk.Asset('USDC', usdcIssuer);

async function checkEscrowAccount() {
  console.log('🔍 Escrow Account Diagnostic\n');
  console.log(`Network: ${config.stellar.network} (${config.stellar.horizonUrl})\n`);

  // Validate configuration
  if (!config.stellar.escrowPublicKey) {
    console.error('❌ ESCROW_PUBLIC_KEY is not set');
    process.exit(1);
  }

  if (!config.stellar.escrowSecretKey) {
    console.warn('⚠️  ESCROW_SECRET_KEY is not set (trustline creation will fail)');
  }

  console.log(`Escrow Public Key: ${config.stellar.escrowPublicKey}`);
  console.log(`USDC Issuer: ${usdcIssuer}\n`);

  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

  try {
    // Load account
    console.log('📡 Fetching account details...');
    const account = await server.loadAccount(config.stellar.escrowPublicKey);

    console.log(`✅ Account exists on ${config.stellar.network}\n`);
    console.log(`Sequence Number: ${account.sequence}`);
    console.log(`Account ID: ${account.id}`);

    // Check balances
    console.log(`\n💰 Account Balances:`);
    account.balances.forEach((balance, idx) => {
      const assetCode = balance.asset_code || 'XLM (native)';
      const assetIssuer = balance.asset_issuer ? `/${balance.asset_issuer.slice(0, 8)}...` : '';
      console.log(`  ${idx + 1}. ${assetCode}${assetIssuer}: ${balance.balance}`);
    });

    // Check for USDC trustline
    const hasUsdcTrustline = account.balances.some(
      (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
    );

    console.log(`\n🔗 USDC Trustline Status:`);
    if (hasUsdcTrustline) {
      console.log(`✅ USDC trustline EXISTS`);
      const usdcBalance = account.balances.find(
        (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
      );
      console.log(`   Balance: ${usdcBalance.balance} USDC`);
      console.log(`   Limit: ${usdcBalance.limit} USDC`);
    } else {
      console.log(`❌ USDC trustline MISSING`);
      console.log(`   The escrow account needs a trustline to USDC to enable swaps.`);
      console.log(`   This trustline should be created automatically on server startup.`);
      console.log(`   If missing, check server bootstrap logs or run:\n`);
      console.log(`   node scripts/checkEscrowAccount.mjs --create-trustline\n`);
    }

    // Check XLM balance for fees
    const xlmBalance = account.balances.find((b) => b.asset_code === undefined);
    console.log(`\n⛽ XLM for Fees:`);
    if (xlmBalance && parseFloat(xlmBalance.balance) >= 1) {
      console.log(`✅ Sufficient XLM (${xlmBalance.balance} XLM)`);
    } else {
      console.log(`❌ Insufficient XLM (${xlmBalance?.balance || '0'} XLM) — need at least 1 XLM for trustline creation`);
    }

    // Suggest next steps
    console.log(`\n📋 Next Steps:`);
    if (!hasUsdcTrustline && config.stellar.escrowSecretKey) {
      console.log(`1. To create USDC trustline, run:`);
      console.log(`   STELLAR_NETWORK=${config.stellar.network} npm run create-trustline\n`);
    }

    if (!hasUsdcTrustline) {
      console.log(`2. Verify the quote engine has these env vars configured:`);
      console.log(`   STELLAR_NETWORK=${config.stellar.network}`);
      console.log(`   HORIZON_URL=${config.stellar.horizonUrl}`);
      console.log(`   USDC_ISSUER_${isTestnet ? 'TESTNET' : 'MAINNET'}=${usdcIssuer}\n`);
    }
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    if (err.message.includes('404')) {
      console.error(`\n   Escrow account does not exist on ${config.stellar.network}`);
      console.error(`   You need to create an account first with proper funding.`);
    } else if (err.message.includes('Network') || err.message.includes('fetch')) {
      console.error(`\n   Cannot reach Horizon API.`);
      console.error(`   Check: HORIZON_URL=${config.stellar.horizonUrl}`);
    }
    process.exit(1);
  }
}

// Optional: Create trustline if requested
async function createTrustline() {
  if (!config.stellar.escrowSecretKey) {
    console.error('❌ ESCROW_SECRET_KEY is required to create trustline');
    process.exit(1);
  }

  console.log('🔐 Creating USDC trustline...\n');

  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
  const keypair = StellarSdk.Keypair.fromSecret(config.stellar.escrowSecretKey);

  try {
    const account = await server.loadAccount(config.stellar.escrowPublicKey);

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase:
        config.stellar.network === 'mainnet'
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET,
    });

    txBuilder.addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_ASSET }));
    txBuilder.setTimeout(30);
    const tx = txBuilder.build();
    tx.sign(keypair);

    console.log('📡 Submitting trustline transaction...');
    const result = await server.submitTransaction(tx);
    console.log(`✅ Trustline created successfully!`);
    console.log(`Transaction hash: ${result.hash}\n`);

    // Verify
    const updatedAccount = await server.loadAccount(config.stellar.escrowPublicKey);
    const hasTrustline = updatedAccount.balances.some(
      (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
    );
    if (hasTrustline) {
      console.log(`✅ Verification complete: USDC trustline now active\n`);
    }
  } catch (err) {
    console.error(`❌ Failed to create trustline: ${err.message}`);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
if (args.includes('--create-trustline')) {
  createTrustline();
} else {
  checkEscrowAccount();
}
