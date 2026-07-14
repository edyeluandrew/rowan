/**
 * One-shot: rename Test Trader Flow / Test Trader 2 display names.
 * Usage: node scripts/rename-test-traders.mjs
 */
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const updates = [
  {
    name: 'Edyelu Andrew',
    where: `name = 'Test Trader Flow' OR email = 'test.trader.flow@rowan.local'`,
  },
  {
    name: 'Muhereza Alouzious',
    where: `name = 'Test Trader 2' OR email = 'test.trader2@rowan.local'`,
  },
];

for (const u of updates) {
  const result = await client.query(
    `UPDATE traders SET name = $1 WHERE ${u.where} RETURNING id, name, email`,
    [u.name]
  );
  console.log(`${u.name}: ${result.rowCount} row(s)`);
  for (const row of result.rows) {
    console.log(`  - ${row.name} <${row.email}>`);
  }
}

await client.end();
