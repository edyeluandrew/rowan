const pg = require('pg');

const client = new pg.Client({
  connectionString: 'postgresql://postgres.lgejzxedoiuhhnotviou:stellar.onchain@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
});

client.connect();

client.query(
  'SELECT id, state, usdc_amount, stellar_swap_tx, trader_id, created_at FROM transactions WHERE id = $1',
  ['71b6fa4f-b28a-417a-aafe-b1c9a49e5fd0'],
  (err, res) => {
    if (err) {
      console.error('❌ Query error:', err.message);
    } else {
      console.log('\n✅ Transaction found:');
      console.table(res.rows);
    }
    client.end();
  }
);
