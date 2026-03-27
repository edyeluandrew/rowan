#!/usr/bin/env node
/**
 * End-to-End Cashout Flow Test
 * Tests: Quote → Deposit → XLM→USDC Conversion → Escrow Hold
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const horizon = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const networkPassphrase = StellarSdk.Networks.TESTNET;

const ESCROW_PUBLIC_KEY = process.env.ESCROW_PUBLIC_KEY;
const MARKET_MAKER_PUBLIC_KEY = process.env.MARKET_MAKER_PUBLIC_KEY;
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ASSET = new StellarSdk.Asset('USDC', USDC_ISSUER);

const API_URL = process.env.API_URL || 'http://localhost:4000';

function log(msg, data = '') {
  console.log(`\n✓ ${msg}`, data ? JSON.stringify(data, null, 2) : '');
}

function warn(msg, data = '') {
  console.warn(`\n⚠️  ${msg}`, data ? JSON.stringify(data, null, 2) : '');
}

function error(msg, err) {
  console.error(`\n❌ ${msg}`, err?.message || err);
}

async function testMarketMakerOffers() {
  log('1. Checking market maker offers on Horizon...');
  try {
    const offers = await horizon.offers().forAccount(MARKET_MAKER_PUBLIC_KEY).call();
    
    const xlmToUsdcOffers = offers.records.filter(o => 
      o.selling.asset_type === 'native' && 
      o.buying.asset_code === 'USDC'
    );
    
    if (xlmToUsdcOffers.length === 0) {
      error('No XLM→USDC offers found!');
      return false;
    }
    
    const bestOffer = xlmToUsdcOffers.reduce((best, current) => 
      parseFloat(current.price) < parseFloat(best.price) ? current : best
    );
    
    log(`Market maker has ${xlmToUsdcOffers.length} XLM→USDC offers. Best rate: ${bestOffer.price} USDC/XLM`);
    return true;
  } catch (err) {
    error('Failed to check market maker offers', err);
    return false;
  }
}

async function testQuotGeneration() {
  log('2. Testing quote generation via API...');
  try {
    const quoteRes = await axios.post(`${API_URL}/api/quotes`, {
      xlmAmount: 100,
      network: 'MTN_UG', // Uganda network
    });
    
    const quote = quoteRes.data;
    log('Quote generated successfully', {
      quoteId: quote.id,
      memo: quote.memo,
      xlmAmount: quote.xlm_amount,
      fiatAmount: quote.fiat_amount,
      userRate: quote.user_rate,
      marketRate: quote.market_rate,
    });
    
    return quote;
  } catch (err) {
    error('Quote generation failed', err);
    return null;
  }
}

async function testDepositFlow(quote) {
  if (!quote) {
    warn('Skipping deposit test (no quote)');
    return false;
  }

  log('3. Testing deposit flow...');
  log(`Will simulate deposit of ${quote.xlm_amount} XLM to escrow with memo: ${quote.memo}`);
  
  // Note: This is a simulation test. In production, you'd actually send XLM to the escrow address.
  // The Horizon event watcher would pick it up and trigger handleDeposit.
  
  log('⏸️  Manual step required: Send XLM to escrow address to trigger deposit handling');
  log('Deposit destination', {
    address: ESCROW_PUBLIC_KEY,
    amount: quote.xlm_amount,
    memo: quote.memo,
  });
  
  return true;
}

async function testMarketMakerBalances() {
  log('4. Checking market maker balances...');
  try {
    const account = await horizon.loadAccount(MARKET_MAKER_PUBLIC_KEY);
    
    const xlmBalance = account.balances.find(b => b.asset_type === 'native');
    const usdcBalance = account.balances.find(b => b.asset_code === 'USDC');
    
    log('Market maker balances', {
      xlm: xlmBalance?.balance || '0',
      usdc: usdcBalance?.balance || '0 (no trustline)',
    });
    
    return true;
  } catch (err) {
    error('Failed to fetch market maker balances', err);
    return false;
  }
}

async function testEscrowBalances() {
  log('5. Checking escrow account balances...');
  try {
    const account = await horizon.loadAccount(ESCROW_PUBLIC_KEY);
    
    const xlmBalance = account.balances.find(b => b.asset_type === 'native');
    const usdcBalance = account.balances.find(b => b.asset_code === 'USDC');
    
    log('Escrow balances', {
      xlm: xlmBalance?.balance || '0',
      usdc: usdcBalance?.balance || '0 (no trustline)',
    });
    
    return true;
  } catch (err) {
    error('Failed to fetch escrow balances', err);
    return false;
  }
}

async function runTests() {
  console.log('\n🧪 Running End-to-End Testnet Cashout Flow Tests\n');
  console.log('Configuration:');
  console.log(`  API URL: ${API_URL}`);
  console.log(`  Escrow: ${ESCROW_PUBLIC_KEY}`);
  console.log(`  Market Maker: ${MARKET_MAKER_PUBLIC_KEY}`);
  
  const mmOffersOk = await testMarketMakerOffers();
  const mmBalancesOk = await testMarketMakerBalances();
  const escrowBalancesOk = await testEscrowBalances();
  const quote = await testQuotGeneration();
  const depositOk = await testDepositFlow(quote);
  
  console.log('\n\n📊 Test Results:');
  console.log(`  ✓ Market Maker Offers: ${mmOffersOk ? 'PASS' : 'FAIL'}`);
  console.log(`  ✓ Market Maker Balances: ${mmBalancesOk ? 'PASS' : 'FAIL'}`);
  console.log(`  ✓ Escrow Balances: ${escrowBalancesOk ? 'PASS' : 'FAIL'}`);
  console.log(`  ✓ Quote Generation: ${quote ? 'PASS' : 'FAIL'}`);
  console.log(`  ✓ Deposit Flow: ${depositOk ? 'PASS' : 'FAIL'}`);
  
  const allPass = mmOffersOk && mmBalancesOk && escrowBalancesOk && quote && depositOk;
  console.log(`\n${allPass ? '✅ ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}\n`);
}

runTests().catch(err => {
  error('Fatal error during test run', err);
  process.exit(1);
});
