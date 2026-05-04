import quoteEngine from './src/services/quoteEngine.js';
import { v4 as uuidv4 } from 'uuid';

const userId = uuidv4();
const xlmAmount = 2.0;
const phoneHash = 'test-phone-hash';

console.log(`\n📊 Testing Legacy-Fallback Quote Creation`);
console.log(`   User ID: ${userId}`);
console.log(`   XLM Amount: ${xlmAmount}`);

try {
  const quote = await quoteEngine.createQuote({
    userId,
    xlmAmount,
    network: 'testnet',
    phoneHash,
  });

  console.log(`\n✅ Quote Created:`);
  console.log(`   Quote ID: ${quote.id}`);
  console.log(`   Quote Source: ${quote.quote_source}`);
  console.log(`   User Rate: ${quote.user_rate}`);
  console.log(`   Path XLM Needed: ${quote.path_xlm_needed}`);
  console.log(`   Path USDC Received: ${quote.path_usdc_received}`);
  
  if (quote.path_xlm_needed && quote.path_usdc_received) {
    const calcRate = quote.path_xlm_needed / quote.path_usdc_received;
    console.log(`   Calculated XLM/USDC Rate: ${calcRate}`);
    console.log(`\n💡 Calculation Check:`);
    console.log(`   Path XLM Needed: ${quote.path_xlm_needed}`);
    console.log(`   Path USDC Received: ${quote.path_usdc_received}`);
    console.log(`   Ratio: ${calcRate} XLM/USDC`);
    
    if (quote.path_xlm_needed > xlmAmount) {
      console.log(`   ⚠️  WARNING: Path needs ${quote.path_xlm_needed} XLM but user only sent ${xlmAmount} XLM!`);
    }
  }
} catch (err) {
  console.error(`\n❌ Error:`, err.message);
} finally {
  process.exit(0);
}
