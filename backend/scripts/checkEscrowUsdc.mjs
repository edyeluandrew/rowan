#!/usr/bin/env node
import { server as horizon, USDC_ASSET } from '../src/config/stellar.js';

const ESCROW = 'GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA';

const account = await horizon.loadAccount(ESCROW);
const usdcBalance = account.balances.find(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ASSET.issuer);

console.log('Escrow USDC Trustline:');
console.log(`  Balance: ${usdcBalance?.balance || '0'}`);
console.log(`  Limit: ${usdcBalance?.limit || 'none'}`);
console.log(`  Available: ${usdcBalance ? parseFloat(usdcBalance.limit) - parseFloat(usdcBalance.balance) : '0'}`);
console.log(`  Is authorized: ${usdcBalance?.is_authorized ?? 'unknown'}`);

if (!usdcBalance) {
  console.log('\n❌ Escrow missing USDC trustline!');
} else if (parseFloat(usdcBalance.limit) - parseFloat(usdcBalance.balance) < 1) {
  console.log('\n⚠️ Escrow USDC limit is full or too low');
} else {
  console.log('\n✅ Escrow USDC trustline OK');
}
