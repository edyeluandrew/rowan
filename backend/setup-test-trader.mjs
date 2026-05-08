import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config(); // Load from .env file

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env file');
  process.exit(1);
}

/**
 * Detect trader configuration mode
 * BATCH MODE: TRADER1_EMAIL, TRADER2_EMAIL, etc. (multiple traders)
 * SINGLE MODE: TEST_TRADER_EMAIL (backwards compatible)
 */
function detectTraderMode() {
  if (process.env.TRADER1_EMAIL) {
    return 'batch';
  }
  if (process.env.TEST_TRADER_EMAIL) {
    return 'single';
  }
  console.error('❌ No trader configuration found in .env');
  console.error('   Either set TRADER1_EMAIL, TRADER2_EMAIL, etc. (batch mode)');
  console.error('   Or set TEST_TRADER_EMAIL (single mode)');
  process.exit(1);
}

/**
 * Load batch traders from env (TRADER1_*, TRADER2_*, etc.)
 */
function loadBatchTraders() {
  const traders = [];
  let i = 1;
  while (process.env[`TRADER${i}_EMAIL`]) {
    const email = process.env[`TRADER${i}_EMAIL`];
    const password = process.env[`TRADER${i}_PASSWORD`];
    const name = process.env[`TRADER${i}_NAME`];
    const methods = process.env[`TRADER${i}_METHODS`] || '';
    const floatUgx = parseInt(process.env[`TRADER${i}_FLOAT_UGX`] || '50000000', 10);
    const floatKes = parseInt(process.env[`TRADER${i}_FLOAT_KES`] || '50000000', 10);
    const floatTzs = parseInt(process.env[`TRADER${i}_FLOAT_TZS`] || '50000000', 10);

    if (!email || !password) {
      console.error(`❌ TRADER${i}_EMAIL or TRADER${i}_PASSWORD not set`);
      process.exit(1);
    }

    traders.push({
      email,
      password,
      name: name || `Trader ${i}`,
      methods: methods.split(',').map(m => m.trim()).filter(m => m),
      float_ugx: floatUgx,
      float_kes: floatKes,
      float_tzs: floatTzs,
    });

    i++;
  }
  return traders;
}

/**
 * Load single trader from env (TEST_TRADER_*)
 */
function loadSingleTrader() {
  const email = process.env.TEST_TRADER_EMAIL;
  const password = process.env.TEST_TRADER_PASSWORD;
  const phone = process.env.TEST_TRADER_PHONE;
  const name = process.env.TEST_TRADER_NAME;

  return [{
    email,
    password,
    phone,
    name: name || 'Test Trader',
    float_ugx: 50000000,
    float_kes: 50000000,
    float_tzs: 50000000,
  }];
}

/**
 * Setup a single trader (create or update)
 */
async function setupTrader(client, trader) {
  const { email, password, name, methods, float_ugx, float_kes, float_tzs } = trader;

  // Check if trader exists
  const existRes = await client.query(
    `SELECT id FROM traders WHERE email = $1`,
    [email]
  );

  let traderId;
  if (existRes.rows.length > 0) {
    traderId = existRes.rows[0].id;
    // Update existing trader
    await client.query(
      `UPDATE traders 
       SET float_ugx = $1,
           float_kes = $2,
           float_tzs = $3,
           daily_limit = 100000000,
           is_active = TRUE,
           trust_score = 100,
           updated_at = NOW()
       WHERE id = $4`,
      [float_ugx, float_kes, float_tzs, traderId]
    );
    console.log(`  ✅ Updated: ${name}`);
  } else {
    // Create new trader
    const createRes = await client.query(
      `INSERT INTO traders 
       (name, email, password_hash, float_ugx, float_kes, float_tzs, 
        daily_limit, trust_score, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 100000000, 100, TRUE, NOW())
       RETURNING id`,
      [name, email, password, float_ugx, float_kes, float_tzs]
    );
    traderId = createRes.rows[0].id;
    console.log(`  ✅ Created: ${name}`);
  }

  // Display trader info
  const traderRes = await client.query(
    `SELECT id, name, is_active, float_ugx, float_kes, float_tzs FROM traders WHERE id = $1`,
    [traderId]
  );
  const trader_data = traderRes.rows[0];
  console.log(`     📧 Email: ${email}`);
  console.log(`     💰 Float UGX: ${trader_data.float_ugx.toLocaleString()}`);
  console.log(`     💰 Float KES: ${trader_data.float_kes.toLocaleString()}`);
  console.log(`     💰 Float TZS: ${trader_data.float_tzs.toLocaleString()}`);

  // Create payout settings if methods provided
  if (methods && methods.length > 0) {
    console.log(`     💳 Methods: ${methods.join(', ')}`);
    for (const method of methods) {
      await client.query(
        `INSERT INTO payout_settings (trader_id, method_type, is_active, created_at)
         VALUES ($1, $2, TRUE, NOW())
         ON CONFLICT (trader_id, method_type) DO NOTHING`,
        [traderId, method]
      );
    }
  }
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();

    const mode = detectTraderMode();
    const traders = mode === 'batch' ? loadBatchTraders() : loadSingleTrader();

    console.log('\n' + '='.repeat(70));
    console.log(`🔐 SETTING UP ${traders.length} TEST TRADER(S) [${mode.toUpperCase()} MODE]`);
    console.log('='.repeat(70) + '\n');

    for (const trader of traders) {
      await setupTrader(client, trader);
      console.log();
    }

    console.log('='.repeat(70));
    console.log('✅ ALL TEST TRADERS READY!\n');
    console.log('🚀 NEXT STEPS:\n');
    console.log('  1. Login at: https://rowan-1-9crb.onrender.com');
    for (let i = 0; i < traders.length; i++) {
      console.log(`     Trader ${i + 1}: ${traders[i].email} / ${traders[i].password}`);
    }
    console.log('\n  2. Create a cashout request from wallet (1-2 XLM)');
    console.log('  3. Traders should be matched automatically');
    console.log('  4. Test accept/payout flow\n');
    console.log('='.repeat(70) + '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
