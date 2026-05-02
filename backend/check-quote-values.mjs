import db from './src/db/index.js';

const quoteId = 'c4eb7eb4-2040-4fe9-9f7b-5e2fe207ad8c';

try {
  const result = await db.query(
    `SELECT id, xlm_amount, path_xlm_needed, path_usdc_received, quote_source, user_rate
     FROM quotes WHERE id = $1`,
    [quoteId]
  );
  
  if (result.rows.length === 0) {
    console.log(`❌ Quote not found: ${quoteId}`);
  } else {
    const quote = result.rows[0];
    console.log(`\n📋 Quote Details:`);
    console.log(`  ID: ${quote.id}`);
    console.log(`  XLM Amount: ${quote.xlm_amount}`);
    console.log(`  Path XLM Needed: ${quote.path_xlm_needed}`);
    console.log(`  Path USDC Received: ${quote.path_usdc_received}`);
    console.log(`  Quote Source: ${quote.quote_source}`);
    console.log(`  User Rate (UGX/XLM): ${quote.user_rate}`);
  }
} catch (err) {
  console.error('Error:', err.message);
} finally {
  process.exit(0);
}
