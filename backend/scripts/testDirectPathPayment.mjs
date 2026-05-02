#!/usr/bin/env node
/**
 * Test direct path payment execution to verify MM offers can be crossed
 */
import StellarSdk from '@stellar/stellar-sdk';
import config from '../src/config/index.js';
import { USDC_ASSET } from '../src/config/stellar.js';

const horizonUrl = 'https://horizon-testnet.stellar.org';
const server = new StellarSdk.Horizon.Server(horizonUrl);
const networkPassphrase = 'Test SDF Network ; September 2015';

// Test accounts
const escrowPublic = 'GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA';
const escrowSecret = process.env.ESCROW_SECRET_KEY;

if (!escrowSecret) {
  console.error('❌ ESCROW_SECRET_KEY not set');
  process.exit(1);
}

const escrowKeypair = StellarSdk.Keypair.fromSecret(escrowSecret);

console.log('Testing Direct Path Payment (Escrow sending XLM, receiving USDC)...\n');

try {
  // Load escrow account
  const account = await server.loadAccount(escrowPublic);
  console.log(`Escrow account loaded (seq: ${account.sequenceNumber()})`);
  
  // Build a pathPaymentStrictReceive
  // Escrow sends 500 XLM, expects to receive at least 100 USDC
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset: StellarSdk.Asset.native(), // Sending XLM
        sendMax: '500',                         // Max 500 XLM
        destination: escrowPublic,              // Escrow receives (same account)
        destAsset: USDC_ASSET,                  // Receiving USDC
        destAmount: '100',                      // Want at least 100 USDC
        path: [],                               // Let Stellar figure out the path
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(escrowKeypair);
  
  console.log('\nSubmitting path payment...');
  const result = await server.submitTransaction(tx);
  
  console.log('\n✅ PATH PAYMENT SUCCEEDED!');
  console.log(`Transaction: ${result.hash}`);
  console.log(`\nThis proves MM's offers CAN be crossed.`);
  console.log(`The issue is just with Horizon's path-finding API, not with actual trading.`);
  
} catch (err) {
  console.error('\n❌ PATH PAYMENT FAILED');
  console.error(`Error: ${err.message}`);
  
  if (err.response?.data?.extras?.result_codes) {
    console.error(`\nStellar Result Codes:`, err.response.data.extras.result_codes);
  }
  
  process.exit(1);
}
