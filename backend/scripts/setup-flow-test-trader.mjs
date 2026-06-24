/**
 * Create or refresh the dedicated flow-test trader from TEST_TRADER_* in .env.
 * Ensures ACTIVE + VERIFIED + payout settings so matching works on testnet.
 *
 * Usage: node scripts/setup-flow-test-trader.mjs
 */
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const email = process.env.TEST_TRADER_EMAIL || 'test.trader.flow@rowan.local';
const password = process.env.TEST_TRADER_PASSWORD || 'TestFlow123!@#';
const name = process.env.TEST_TRADER_NAME || 'Test Trader Flow';
const phone = process.env.TEST_TRADER_PHONE || '+256704888999';
// Testnet keypair with USDC trustline (same as escrow/MM test infra)
const stellarAddress =
  process.env.TEST_TRADER_STELLAR_ADDRESS ||
  process.env.MARKET_MAKER_PUBLIC_KEY ||
  'GCKSEJOEMXEGHE675YMWSGFI2LX7XX6DBBJ7IWN3QN2N7645EYLV2LRF';

const networks = [
  { network: 'AIRTEL_UG', currency: 'UGX', country: 'UG' },
  { network: 'MTN_UG', currency: 'UGX', country: 'UG' },
];

const FLOAT = 5_000_000;
const MIN = 20_000;
const MAX = 550_000;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const passwordHash = await bcrypt.hash(password, 12);

const existing = await client.query(`SELECT id FROM traders WHERE email = $1`, [email]);
let traderId;

if (existing.rows.length > 0) {
  traderId = existing.rows[0].id;
  await client.query(
    `UPDATE traders SET
       name = $1, password_hash = $2, stellar_address = $3,
       status = 'ACTIVE', verification_status = 'VERIFIED',
       is_active = TRUE, trust_score = 100,
       daily_limit_ugx = 100000000, float_ugx = $4,
       updated_at = NOW()
     WHERE id = $5`,
    [name, passwordHash, stellarAddress, FLOAT, traderId]
  );
  console.log(`Updated existing trader: ${email}`);
} else {
  const created = await client.query(
    `INSERT INTO traders (
       name, email, password_hash, stellar_address,
       status, verification_status, is_active, trust_score,
       daily_limit_ugx, daily_volume, float_ugx, float_kes, float_tzs,
       networks, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4,
       'ACTIVE', 'VERIFIED', TRUE, 100,
       100000000, 0, $5, 0, 0,
       $6::text[], NOW(), NOW()
     ) RETURNING id`,
    [name, email, passwordHash, stellarAddress, FLOAT, networks.map((n) => n.network)]
  );
  traderId = created.rows[0].id;
  console.log(`Created new trader: ${email}`);
}

for (const { network, currency, country } of networks) {
  await client.query(
    `INSERT INTO trader_payout_settings (
       trader_id, country, network, currency,
       min_amount, max_amount, available_float, reserved_float, is_active,
       created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, TRUE, NOW(), NOW())
     ON CONFLICT (trader_id, network, currency) DO UPDATE SET
       available_float = GREATEST(trader_payout_settings.available_float, EXCLUDED.available_float),
       reserved_float = 0,
       is_active = TRUE,
       min_amount = EXCLUDED.min_amount,
       max_amount = EXCLUDED.max_amount,
       updated_at = NOW()`,
    [traderId, country, network, currency, MIN, MAX, FLOAT]
  );
}

const summary = await client.query(
  `SELECT t.email, t.name, t.status, t.verification_status, t.stellar_address,
          (SELECT json_agg(json_build_object('network', ps.network, 'float', ps.available_float, 'active', ps.is_active))
           FROM trader_payout_settings ps WHERE ps.trader_id = t.id) AS payout_settings
   FROM traders t WHERE t.id = $1`,
  [traderId]
);

await client.end();

const row = summary.rows[0];
console.log('\n=== FLOW TEST TRADER READY ===\n');
console.log(`Email:    ${email}`);
console.log(`Password: ${password}`);
console.log(`Phone:    ${phone}`);
console.log(`Status:   ${row.status} / ${row.verification_status}`);
console.log(`Stellar:  ${row.stellar_address}`);
console.log(`Networks: ${JSON.stringify(row.payout_settings)}`);
console.log('\nMobile login: OTC Trader → Sign In');
console.log('Cashout as wallet user: pick AIRTEL_UG or MTN_UG (20k–550k UGX)\n');
