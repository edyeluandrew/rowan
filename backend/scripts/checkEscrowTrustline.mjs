#!/usr/bin/env node
import { server as horizon, USDC_ASSET } from '../src/config/stellar.js';

const escrowPub = 'GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA';

try {
  const account = await horizon.loadAccount(escrowPub);
  console.log(`Escrow account: ${escrowPub.slice(0, 8)}...`);
  console.log(`\nBalances:`);
  account.balances.forEach(b => {
    if (b.asset_type === 'native') {
      console.log(`  XLM: ${b.balance}`);
    } else {
      console.log(`  ${b.asset_code}/${b.asset_issuer.slice(0,8)}...: ${b.balance}`);
    }
  });
  
  const hasUsdc = account.balances.some(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ASSET.issuer);
  console.log(`\nUSDP trustline: ${hasUsdc ? '✅ YES' : '❌ NO'}`);
  
  if (!hasUsdc) {
    console.log('\n⚠️  Escrow needs USDC trustline to receive USDC in path discovery');
    console.log('Run: node scripts/checkEscrowAccount.mjs --create-trustline');
  }
} catch (err) {
  console.error('Error:', err.message);
}
