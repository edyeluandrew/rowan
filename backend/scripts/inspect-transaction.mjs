import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.staging') });

const txId = process.argv[2] || '58bf116e-d7d1-46f8-83ec-577b85e6a795';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const r = await pool.query(
    `SELECT id, state, network, fiat_amount, fiat_currency, usdc_amount,
            payout_phone, payout_name, payout_provider, payment_rail,
            aggregator_ref, trader_id, stellar_deposit_tx, escrow_locked_at,
            fiat_payout_submitted_at, failure_reason, created_at
     FROM transactions WHERE id = $1`,
    [txId]
  );
  console.log(JSON.stringify(r.rows[0] || null, null, 2));
} finally {
  await pool.end();
}
