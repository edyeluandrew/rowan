import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const email = 'testuser2@rowan.test';
const t = await c.query(
  `SELECT id, name, email, status, is_active, verification_status,
          networks, float_ugx, daily_limit_ugx, daily_volume,
          stellar_address, password_hash IS NOT NULL AS has_password
   FROM traders WHERE email = $1`,
  [email]
);
console.log('\n=== TRADER ===');
console.log(JSON.stringify(t.rows[0], null, 2));

if (t.rows[0]) {
  const v = await c.query(
    `SELECT verification_status, identity_check, momo_check, p2p_check, agreement_check
     FROM trader_verifications WHERE trader_id = $1`,
    [t.rows[0].id]
  );
  console.log('\n=== VERIFICATION ===');
  console.log(JSON.stringify(v.rows[0] || null, null, 2));

  const m = await c.query(
    `SELECT network, phone_number, verification_status
     FROM trader_momo_accounts WHERE trader_id = $1`,
    [t.rows[0].id]
  );
  console.log('\n=== MOMO ACCOUNTS ===');
  console.log(JSON.stringify(m.rows, null, 2));
}

await c.end();
