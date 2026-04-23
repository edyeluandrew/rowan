import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();

    const quoteId = process.argv[2];
    if (!quoteId) {
      console.error('❌ Usage: node check-transaction.mjs <quoteId>');
      process.exit(1);
    }

    console.log(`\n📊 CHECKING TRANSACTION STATUS FOR QUOTE: ${quoteId}\n`);
    console.log('='.repeat(80));

    // Check quote
    console.log(`\n1️⃣  CHECKING QUOTE:`);
    const quoteResult = await client.query(
      `SELECT id, user_id, xlm_amount, fiat_amount, fiat_currency, is_used, expires_at, created_at
       FROM quotes WHERE id = $1`,
      [quoteId]
    );

    if (quoteResult.rows.length === 0) {
      console.log(`   ❌ Quote NOT FOUND in database`);
      return;
    }

    const quote = quoteResult.rows[0];
    console.log(`   ✅ Quote found:`);
    console.log(`      ID: ${quote.id}`);
    console.log(`      User ID: ${quote.user_id}`);
    console.log(`      XLM: ${quote.xlm_amount}`);
    console.log(`      Fiat: ${quote.fiat_amount} ${quote.fiat_currency}`);
    console.log(`      Used: ${quote.is_used}`);
    console.log(`      Expires: ${quote.expires_at}`);

    // Check transaction
    console.log(`\n2️⃣  CHECKING TRANSACTION:`);
    const txResult = await client.query(
      `SELECT id, state, xlm_amount, usdc_amount, fiat_amount, stellar_deposit_tx, 
              stellar_swap_tx, trader_id, created_at, escrow_locked_at, trader_matched_at
       FROM transactions WHERE quote_id = $1`,
      [quoteId]
    );

    if (txResult.rows.length === 0) {
      console.log(`   ⏳ Transaction NOT YET CREATED (Horizon watcher may still be processing)`);
      console.log(`      This is normal — wait 10-15 seconds and check again`);
      return;
    }

    const tx = txResult.rows[0];
    console.log(`   ✅ Transaction found:`);
    console.log(`      ID: ${tx.id}`);
    console.log(`      State: ${tx.state}`);
    console.log(`      XLM: ${tx.xlm_amount}`);
    console.log(`      USDC: ${tx.usdc_amount}`);
    console.log(`      Fiat: ${tx.fiat_amount}`);
    console.log(`      Deposit TX: ${tx.stellar_deposit_tx || 'pending'}`);
    console.log(`      Swap TX: ${tx.stellar_swap_tx || 'pending'}`);
    console.log(`      Trader ID: ${tx.trader_id || 'not matched yet'}`);
    console.log(`      Created: ${tx.created_at}`);
    console.log(`      Escrow Locked: ${tx.escrow_locked_at}`);
    console.log(`      Trader Matched: ${tx.trader_matched_at || 'pending'}`);

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
