import db from '../src/db/index.js';

const files = [
  '001_initial_schema.sql',
  '002_deep_spec_fields.sql',
  '003_admin_columns.sql',
  '004_trader_verification.sql',
  '005_add_refunded_at.sql',
  '006_release_attempt_columns.sql',
  '007_multi_currency_float.sql',
  '008_agreement_ip.sql',
  '009_standardize_and_views.sql',
  '010_daily_volume_ugx.sql',
  '011_schema_cleanup.sql',
];

for (const f of files) {
  try {
    await db.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
      [f]
    );
    console.log('Marked:', f);
  } catch (e) {
    console.log('Skip:', f, e.message);
  }
}

console.log('Done — all migrations marked as applied');
await db.pool.end();
process.exit(0);
