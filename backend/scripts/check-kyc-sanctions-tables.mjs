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

try {
  const r = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('kyc_submissions', 'sanctioned_entities', 'screening_checks')
    ORDER BY table_name
  `);
  console.log('Existing tables:', r.rows.map((x) => x.table_name));
} finally {
  await pool.end();
}
