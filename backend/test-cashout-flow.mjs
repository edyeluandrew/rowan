import pg from 'pg';

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();

    console.log('\n📊 CASHOUT FLOW TEST\n');
    console.log('='.repeat(60));

    // Check trader float
    const traderRes = await client.query(
      `SELECT id, name, status, verification_status, float_ugx, float_kes, float_tzs 
       FROM traders 
       WHERE name = 'Test User 2'`
    );

    if (traderRes.rows.length === 0) {
      console.log('❌ Trader "Test User 2" not found');
      return;
    }

    const trader = traderRes.rows[0];
    console.log('\n✅ TRADER STATUS:\n');
    console.log(`  Name: ${trader.name}`);
    console.log(`  Status: ${trader.status} (${trader.verification_status})`);
    console.log(`  Float UGX: ${trader.float_ugx.toLocaleString()}`);
    console.log(`  Float KES: ${trader.float_kes.toLocaleString()}`);
    console.log(`  Float TZS: ${trader.float_tzs.toLocaleString()}`);

    // Check recent transactions
    const txRes = await client.query(
      `SELECT id, state, usdc_amount, fiat_currency, fiat_amount, trader_id, created_at 
       FROM transactions 
       ORDER BY created_at DESC 
       LIMIT 10`
    );

    console.log('\n📋 RECENT TRANSACTIONS:\n');
    if (txRes.rows.length === 0) {
      console.log('  No transactions found');
    } else {
      txRes.rows.forEach((tx, i) => {
        const matched = tx.trader_id ? '✅ MATCHED' : '⏳ WAITING';
        console.log(`  ${i + 1}. [${matched}] ${tx.id.slice(0, 8)}... | State: ${tx.state} | USDC: ${tx.usdc_amount} | ${tx.fiat_currency} ${tx.fiat_amount}`);
      });
    }

    // Check for stuck transactions
    const stuckRes = await client.query(
      `SELECT id, state, trader_id, created_at, 
              EXTRACT(EPOCH FROM (NOW() - created_at)) as age_seconds
       FROM transactions 
       WHERE state = 'TRADER_MATCHED' AND trader_id IS NULL AND created_at > NOW() - INTERVAL '10 minutes'
       ORDER BY created_at DESC`
    );

    console.log('\n⚠️  TRANSACTIONS NEEDING TRADER:\n');
    if (stuckRes.rows.length === 0) {
      console.log('  ✅ No stuck transactions');
    } else {
      stuckRes.rows.forEach((tx) => {
        const mins = Math.floor(tx.age_seconds / 60);
        console.log(`  ⏳ ${tx.id.slice(0, 8)}... | Waiting ${mins}min | Auto-refund in ${5 - mins}min`);
      });
    }

    // Check trader daily volume
    const volumeRes = await client.query(
      `SELECT 
         t.id, t.name, t.float_ugx, t.daily_limit_ugx,
         COALESCE(SUM(CASE WHEN tx.state = 'COMPLETE' THEN tx.fiat_amount ELSE 0 END), 0) as daily_volume
       FROM traders t
       LEFT JOIN transactions tx ON tx.trader_id = t.id 
         AND tx.state = 'COMPLETE' 
         AND DATE(tx.created_at) = DATE(NOW())
       WHERE t.name = 'Test User 2'
       GROUP BY t.id, t.name, t.float_ugx, t.daily_limit_ugx`
    );

    if (volumeRes.rows.length > 0) {
      const vol = volumeRes.rows[0];
      const used = vol.daily_volume || 0;
      const available = vol.daily_limit_ugx - used;
      console.log('\n💰 TRADER DAILY CAPACITY:\n');
      console.log(`  Daily Limit: ${vol.daily_limit_ugx.toLocaleString()} UGX`);
      console.log(`  Used Today: ${used.toLocaleString()} UGX`);
      console.log(`  Available: ${available.toLocaleString()} UGX`);
      console.log(`  Float Available: ${vol.float_ugx.toLocaleString()} UGX`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📝 NEXT STEPS:\n');
    console.log('  1. Make a test cashout request (1-2 XLM)');
    console.log('  2. Trader should be matched automatically');
    console.log('  3. Watch logs for state transitions\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
