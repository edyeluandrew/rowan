/**
 * Enable MTN_UG on testuser2 and release float reserved on stale TRADER_MATCHED txs.
 * Usage: node scripts/fix-test-traders-for-matching.mjs
 */
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// Enable MTN on testuser2
await c.query(
  `UPDATE trader_payout_settings SET is_active = TRUE, updated_at = NOW()
   WHERE trader_id = (SELECT id FROM traders WHERE email = 'testuser2@rowan.test')
     AND network = 'MTN_UG'`
);

// Reset reserved float on flow trader (stale reservations from unaccepted matches)
await c.query(
  `UPDATE trader_payout_settings ps
   SET reserved_float = COALESCE((
     SELECT SUM(t.fiat_amount::numeric)
     FROM transactions t
     WHERE t.payout_setting_id = ps.id
       AND t.state IN ('TRADER_MATCHED','FIAT_PAYOUT_SUBMITTED','USER_CONFIRMATION_PENDING')
   ), 0),
   updated_at = NOW()
   FROM traders tr
   WHERE ps.trader_id = tr.id
     AND tr.email IN ('test.trader.flow@rowan.local', 'testuser2@rowan.test')`
);

const check = await c.query(`
  SELECT tr.email, ps.network, ps.is_active, ps.available_float, ps.reserved_float
  FROM trader_payout_settings ps
  JOIN traders tr ON tr.id = ps.trader_id
  WHERE tr.email IN ('testuser2@rowan.test', 'test.trader.flow@rowan.local')
  ORDER BY tr.email, ps.network
`);
console.log(JSON.stringify(check.rows, null, 2));

await c.end();
