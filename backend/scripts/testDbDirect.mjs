import pg from 'pg';
const { Pool } = pg;

// Try direct connection (non-pooler)
const directUrl = 'postgresql://postgres.lgejzxedoiuhhnotviou:stellar.onchain@db.lgejzxedoiuhhnotviou.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString: directUrl,
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
