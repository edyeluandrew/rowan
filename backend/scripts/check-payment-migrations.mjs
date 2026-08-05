import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.staging') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const targets = [
  '046_five_country_yellow_pay_routing.sql',
  '047_transaction_payment_rail.sql',
  '048_kotani_pay_primary_routing.sql',
];

try {
  const applied = await pool.query(
    'SELECT filename, applied_at FROM schema_migrations WHERE filename = ANY($1) ORDER BY filename',
    [targets]
  );

  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
      AND column_name IN ('payout_provider', 'payment_rail', 'aggregator_ref', 'aggregator_settlement_tx')
    ORDER BY column_name
  `);

  const countries = await pool.query(`
    SELECT code,
           payment_config->>'default_offramp_provider' AS primary_provider,
           payment_config->'offramp' AS offramp_chain
    FROM countries
    WHERE code IN ('UG','KE','TZ','RW','NG','GH')
    ORDER BY code
  `);

  const ngGh = await pool.query(`
    SELECT country_code, network_code FROM country_payment_methods
    WHERE country_code IN ('NG','GH')
    ORDER BY country_code, sort_order
  `);

  console.log('=== schema_migrations (046-048) ===');
  for (const t of targets) {
    const row = applied.rows.find((r) => r.filename === t);
    console.log(row ? `APPLIED  ${t} @ ${row.applied_at}` : `MISSING  ${t}`);
  }

  console.log('\n=== transactions columns ===');
  console.log(cols.rows.map((r) => r.column_name).join(', ') || '(none found)');

  console.log('\n=== countries payment_config ===');
  for (const r of countries.rows) {
    console.log(`${r.code}: primary=${r.primary_provider} chain=${JSON.stringify(r.offramp_chain)}`);
  }

  console.log('\n=== NG/GH networks (046) ===');
  console.log(
    ngGh.rows.length
      ? ngGh.rows.map((r) => `${r.country_code}/${r.network_code}`).join(', ')
      : '(none)'
  );
} catch (err) {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
