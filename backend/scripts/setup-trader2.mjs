/**
 * Create a fresh testnet Trader 2: login, VERIFIED, float, new Stellar wallet + USDC trustline.
 *
 * Usage: node scripts/setup-trader2.mjs
 *
 * Env (optional):
 *   TRADER2_EMAIL, TRADER2_PASSWORD, TRADER2_NAME, TRADER2_PHONE
 */
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import StellarSdk from '@stellar/stellar-sdk';
import config from '../src/config/index.js';
import { USDC_ASSET, networkPassphrase } from '../src/config/stellar.js';

dotenv.config();

const email = process.env.TRADER2_EMAIL || 'test.trader2@rowan.local';
const password = process.env.TRADER2_PASSWORD || 'TestTrader2!Pass123';
const name = process.env.TRADER2_NAME || 'Muhereza Alouzious';
const phone = process.env.TRADER2_PHONE || '+256701234567';

const networks = [
  { network: 'AIRTEL_UG', currency: 'UGX', country: 'UG' },
  { network: 'MTN_UG', currency: 'UGX', country: 'UG' },
];

const FLOAT = 5_000_000;
const MIN = 20_000;
const MAX = 550_000;

const horizon = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

async function fundAndTrustline(keypair) {
  const publicKey = keypair.publicKey();

  try {
    await horizon.loadAccount(publicKey);
  } catch (err) {
    if (err?.response?.status !== 404) throw err;
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    if (!res.ok) throw new Error(`Friendbot failed: ${await res.text()}`);
    console.log('Funded new account via Friendbot');
    await new Promise((r) => setTimeout(r, 3000));
  }

  const account = await horizon.loadAccount(publicKey);
  const hasTrustline = account.balances.some(
    (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
  );

  if (!hasTrustline) {
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: config.stellarMaxFee || StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_ASSET }))
      .setTimeout(30)
      .build();
    tx.sign(keypair);
    const result = await horizon.submitTransaction(tx);
    console.log(`USDC trustline created: ${result.hash}`);
  } else {
    console.log('USDC trustline already exists');
  }

  return publicKey;
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

await client.connect();

const keypair = StellarSdk.Keypair.random();
console.log('\nGenerating new Stellar wallet for Trader 2...');
const stellarAddress = await fundAndTrustline(keypair);

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
  console.log(`Updated existing trader row: ${email}`);
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

await client.end();

console.log('\n=== TRADER 2 READY ===\n');
console.log(`Email:          ${email}`);
console.log(`Password:       ${password}`);
console.log(`Phone (ref):    ${phone}`);
console.log(`Stellar (G):    ${stellarAddress}`);
console.log(`Stellar (S):    ${keypair.secret()}`);
console.log(`Float:          ${FLOAT.toLocaleString()} UGX per network (MTN_UG + AIRTEL_UG)`);
console.log(`Status:         ACTIVE / VERIFIED`);
console.log('\nMobile: OTC Trader → Sign In with email above');
console.log('Save the S... secret somewhere safe (testnet only).\n');
