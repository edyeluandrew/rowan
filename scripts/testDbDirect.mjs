import pg from 'pg';
const { Pool } = pg;

// Use DATABASE_URL from environment
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10000,
});

try {
  const res = await pool.query('SELECT NOW()');
  console.log('DIRECT SUCCESS:', res.rows[0]);
} catch (err) {
  console.error('DIRECT FAIL:', err.message);
  if (err.cause) console.error('CAUSE:', err.cause.message);
} finally {
  await pool.end();
}
