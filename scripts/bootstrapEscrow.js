#!/usr/bin/env node
/**
 * Ensure the escrow account has a USDC trustline on Stellar.
 * Usage: node scripts/bootstrapEscrow.js
 */
import dotenv from 'dotenv';
dotenv.config();

import StellarSdk from '@stellar/stellar-sdk';

async function main() {
  const network = process.env.STELLAR_NETWORK || 'testnet';
  const horizonUrl = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const escrowPub = process.env.ESCROW_PUBLIC_KEY;
  const escrowSecret = process.env.ESCROW_SECRET_KEY;

  if (!escrowPub || !escrowSecret) {
    console.error('Set ESCROW_PUBLIC_KEY and ESCROW_SECRET_KEY in .env');
    process.exit(1);
  }

  const server = new StellarSdk.Horizon.Server(horizonUrl);
  const usdcAsset = new StellarSdk.Asset(
    'USDC',
    network === 'testnet'
      ? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' // testnet USDC issuer
      : 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'  // mainnet Circle USDC
  );

  const account = await server.loadAccount(escrowPub);
  const hasTrustline = account.balances.some(
    (b) => b.asset_code === usdcAsset.code && b.asset_issuer === usdcAsset.issuer
  );

  if (hasTrustline) {
    console.log('USDC trustline already exists on escrow account');
    process.exit(0);
  }

  console.log('Creating USDC trustline...');
  const keypair = StellarSdk.Keypair.fromSecret(escrowSecret);
  const networkPassphrase = network === 'mainnet' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;

  const txBuilder = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  });
  txBuilder.addOperation(StellarSdk.Operation.changeTrust({ asset: usdcAsset }));
  txBuilder.setTimeout(30);
  const tx = txBuilder.build();
  tx.sign(keypair);

  const result = await server.submitTransaction(tx);
  console.log(`USDC trustline created. Hash: ${result.hash}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
