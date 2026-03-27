/**
 * Quick Test: Quote Engine Market Maker Integration
 * Tests Quote Engine functions directly without Redis
 */

import dotenv from 'dotenv';
dotenv.config();

import { server as horizon, USDC_ASSET, StellarSdk } from '../src/config/stellar.js';
import config from '../src/config/index.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(msg) {
  console.log(`${colors.blue}[QUICK TEST]${colors.reset} ${msg}`);
}

function success(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function warn(msg) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

function error(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
}

/**
 * Replicate getMarketMakerRate() logic locally to test
 */
async function testMarketMakerRate() {
  log('Testing Market Maker Rate Fetch (Horizon query)...');
  
  if (!config.stellar.marketMakerPublicKey) {
    error('Market maker not configured');
    return null;
  }

  try {
    const offers = await horizon
      .offers()
      .forAccount(config.stellar.marketMakerPublicKey)
      .call();

    const xlmToUsdcOffers = offers.records.filter(offer => {
      const sellingIsNative = offer.selling.asset_type === 'native';
      const buyingIsUsdc = offer.buying.asset_code === 'USDC' &&
                           offer.buying.asset_issuer === config.usdcIssuerTestnet;
      return sellingIsNative && buyingIsUsdc;
    });

    if (xlmToUsdcOffers.length === 0) {
      warn('No XLM→USDC offers found');
      return null;
    }

    const bestOffer = xlmToUsdcOffers.reduce((best, current) => {
      const currentPrice = parseFloat(current.price);
      const bestPrice = parseFloat(best.price);
      return currentPrice < bestPrice ? current : best;
    });

    const bestRate = parseFloat(bestOffer.price);
    success(`Market Maker best rate: ${bestRate} USDC/XLM`);
    success(`Best offer ID: ${bestOffer.id}, Amount: ${bestOffer.amount} XLM`);
    return bestRate;
  } catch (err) {
    error(`Failed to fetch market maker rate: ${err.message}`);
    return null;
  }
}

/**
 * Test USDC to Fiat rate conversion (should be from config)
 */
function testUsdcToFiatRate() {
  log('Testing USDC to Fiat Rate Conversion...');
  
  const rates = config.usdcFiatRates;
  success(`Loaded rates from config:`);
  Object.entries(rates).forEach(([fiat, rate]) => {
    log(`  - ${fiat}: ${rate} ${fiat}/USDC`);
  });
  
  return rates;
}

/**
 * Test rate calculation (MM rate * USDC→fiat)
 */
async function testRateCalculation() {
  log('Testing Rate Calculation (MM → Fiat)...');
  
  try {
    const mmRate = await testMarketMakerRate();
    if (!mmRate) {
      warn('Cannot test rate calculation without MM rate');
      return;
    }

    const usdcRates = testUsdcToFiatRate();
    
    // Calculate XLM rates in each fiat currency
    log('\nCalculated XLM rates (using market maker):');
    for (const [fiat, usdcToFiatRate] of Object.entries(usdcRates)) {
      const xlmToFiatRate = mmRate * usdcToFiatRate;
      success(`  ${fiat}: ${xlmToFiatRate.toFixed(2)} ${fiat}/XLM`);
    }
  } catch (err) {
    error(`Failed to test rate calculation: ${err.message}`);
  }
}

/**
 * Simulate a quote calculation
 */
async function testQuoteSimulation() {
  log('\nSimulating Quote Creation...');
  
  try {
    const mmRate = await testMarketMakerRate();
    if (!mmRate) {
      warn('Cannot simulate quote without MM rate');
      return;
    }

    // Simulate user requesting 100,000 UGX quote
    const fiatAmount = 100000;
    const fiatCurrency = 'UGX';
    const usdcToUgx = config.usdcFiatRates['UGX'];
    
    const xlmToUgxRate = mmRate * usdcToUgx;
    
    // Calculate XLM amount before fees
    const xlmBeforeFee = fiatAmount / xlmToUgxRate;
    
    // Apply platform fee (from config)
    const platformFeePercent = config.platform.feePercent;
    const platformFeeXlm = xlmBeforeFee * (platformFeePercent / 100);
    const xlmWithFee = xlmBeforeFee + platformFeeXlm;
    
    // Apply spread (from config)
    const spreadPercent = config.platform.spreadPercent;
    const spreadXlm = xlmWithFee * (spreadPercent / 100);
    const finalQuote = xlmWithFee + spreadXlm;
    
    success(`Quote for ${fiatAmount} ${fiatCurrency}:`);
    log(`  - XLM→${fiatCurrency} rate: ${xlmToUgxRate.toFixed(4)}`);
    log(`  - Base XLM needed: ${xlmBeforeFee.toFixed(7)}`);
    log(`  - Platform fee (${platformFeePercent}%): ${platformFeeXlm.toFixed(7)} XLM`);
    log(`  - Subtotal: ${xlmWithFee.toFixed(7)} XLM`);
    log(`  - Spread (${spreadPercent}%): ${spreadXlm.toFixed(7)} XLM`);
    log(`  - FINAL QUOTE: ${finalQuote.toFixed(7)} XLM`);
  } catch (err) {
    error(`Failed to simulate quote: ${err.message}`);
  }
}

async function main() {
  try {
    log('START: Quick Test of Market Maker Integration');
    log(`Config: STELLAR_NETWORK=${config.stellar.network}`);
    log(`Config: MARKET_MAKER_PUBLIC_KEY=${config.stellar.marketMakerPublicKey}`);
    log('');

    // Test 1: Fetch market maker offers
    await testMarketMakerRate();

    // Test 2: USDC→fiat conversion
    log('');
    testUsdcToFiatRate();

    // Test 3: Rate calculation
    log('');
    await testRateCalculation();

    // Test 4: Quote simulation
    await testQuoteSimulation();

    success('\n✅ All quick tests completed!');
  } catch (err) {
    error(`Fatal error: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();
