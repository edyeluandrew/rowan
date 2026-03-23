import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10000,
});

try {
  const res = await pool.query('SELECT NOW()');
  console.log('SUCCESS:', res.rows[0]);
} catch (err) {
  console.error('FAIL:', err.message);
  if (err.cause) console.error('CAUSE:', err.cause.message);
} finally {
  await pool.end();
}
