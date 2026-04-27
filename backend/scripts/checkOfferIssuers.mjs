#!/usr/bin/env node
import { server as horizon, USDC_ASSET } from '../src/config/stellar.js';

const MM = 'GCKSEJOEMXEGHE675YMWSGFI2LX7XX6DBBJ7IWN3QN2N7645EYLV2LRF';

console.log('MM Offers Check:');
console.log(`Expected USDC issuer: ${USDC_ASSET.issuer}`);

const offers = await horizon.offers().forAccount(MM).call();
console.log(`\nActual offers on MM account:`);

offers.records.forEach((o, i) => {
  if (o.buying.asset_code === 'USDC') {
    console.log(`\nOffer ${i+1}:`);
    console.log(`  Selling: ${o.selling.asset_type === 'native' ? 'XLM' : o.selling.asset_code}`);
    console.log(`  Buying: ${o.buying.asset_code}`);
    console.log(`  Buying Issuer: ${o.buying.asset_issuer}`);
    console.log(`  Match: ${o.buying.asset_issuer === USDC_ASSET.issuer ? '✅' : '❌'}`);
  }
});
