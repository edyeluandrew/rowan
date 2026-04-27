#!/usr/bin/env node
import config from '../src/config/index.js';
import { server as horizon, USDC_ASSET } from '../src/config/stellar.js';

const mmPub = process.env.MARKET_MAKER_PUBLIC_KEY || 'GCKSEJOEMXEGHE675YMWSGFI2LX7XX6DBBJ7IWN3QN2N7645EYLV2LRF';

(async () => {
  try {
    console.log('[Diagnostics] Checking market maker offers...\n');
    
    const offers = await horizon.offers().forAccount(mmPub).call();
    console.log(`Market maker ${mmPub.slice(0,8)}...`);
    console.log(`Total offers: ${offers.records.length}\n`);
    
    if (offers.records.length === 0) {
      console.log('❌ NO OFFERS FOUND - This explains the missing Horizon path!\n');
      console.log('Possible causes:');
      console.log('1. Market maker never set up any offers');
      console.log('2. Offers have been closed/cancelled');
      console.log('3. Account is on different network (not testnet)');
    } else {
      console.log('Active Offers:');
      offers.records.forEach((offer, i) => {
        const selling = offer.selling.asset_type === 'native' ? 'XLM' : `${offer.selling.asset_code}/${offer.selling.asset_issuer.slice(0,8)}...`;
        const buying = offer.buying.asset_type === 'native' ? 'XLM' : `${offer.buying.asset_code}/${offer.buying.asset_issuer.slice(0,8)}...`;
        console.log(`  ${i+1}. Sell ${selling} → Buy ${buying} @ price ${offer.price} (amount: ${offer.amount})`);
      });
      
      // Check for XLM→USDC offers specifically
      const xlmToUsdc = offers.records.filter(o => 
        o.selling.asset_type === 'native' && 
        o.buying.asset_code === 'USDC' &&
        o.buying.asset_issuer === USDC_ASSET.issuer
      );
      console.log(`\nXLM→USDC offers: ${xlmToUsdc.length}`);
      if (xlmToUsdc.length === 0) {
        console.log('❌ No XLM→USDC offers! The path discovery will fail.');
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
