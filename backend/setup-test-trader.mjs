import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config(); // Load from .env file

const { Client } = pg;

// Get credentials from environment
const testEmail = process.env.TEST_TRADER_EMAIL;
const testPassword = process.env.TEST_TRADER_PASSWORD;
const testPhone = process.env.TEST_TRADER_PHONE;
const traderName = process.env.TEST_TRADER_NAME;

if (!testEmail || !testPassword) {
  console.error('❌ TEST_TRADER credentials not set in .env file');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env file');
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();

    console.log('\n🔐 CREATING TEST TRADER FROM .ENV\n');
    console.log('='.repeat(70));

    console.log('\n📝 TEST TRADER CREDENTIALS:\n');
    console.log(`  📧 Email:    ${testEmail}`);
    console.log(`  📱 Phone:    ${testPhone}`);
    console.log(`  🔐 Password: ${testPassword}`);
    console.log(`  👤 Name:     ${traderName}\n`);

    console.log('\n💼 SETTING UP TRADER PROFILE:\n');

    // Check if trader exists
    let traderRes = await client.query(
      `SELECT id FROM traders WHERE email = $1`,
      [testEmail]
    );

    if (traderRes.rows.length > 0) {
      // Update existing trader
      const traderId = traderRes.rows[0].id;
      const updateRes = await client.query(
        `UPDATE traders 
         SET float_ugx = 1000000,
             float_kes = 1000000,
             float_tzs = 1000000,
             daily_limit = 100000000,
             is_active = TRUE,
             trust_score = 100,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, is_active, float_ugx, float_kes, float_tzs`,
        [traderId]
      );

      const updated = updateRes.rows[0];
      console.log(`✅ Trader Updated: ${updated.name}`);
      console.log(`   Status: ACTIVE (${updated.is_active ? 'active' : 'inactive'})`);
      console.log(`   Float UGX: ${updated.float_ugx.toLocaleString()}`);
      console.log(`   Float KES: ${updated.float_kes.toLocaleString()}`);
      console.log(`   Float TZS: ${updated.float_tzs.toLocaleString()}`);
    } else {
      // Create new trader
      const createRes = await client.query(
        `INSERT INTO traders 
         (name, email, password_hash, float_ugx, float_kes, float_tzs, 
          daily_limit, trust_score, is_active, created_at)
         VALUES ($1, $2, $3, 1000000, 1000000, 1000000, 
                 100000000, 100, TRUE, NOW())
         RETURNING id, name, is_active, float_ugx, float_kes, float_tzs`,
        [traderName, testEmail, testPassword]
      );

      const trader = createRes.rows[0];
      console.log(`✅ Trader Created: ${trader.name}`);
      console.log(`   Status: ACTIVE (${trader.is_active ? 'active' : 'inactive'})`);
      console.log(`   Float UGX: ${trader.float_ugx.toLocaleString()}`);
      console.log(`   Float KES: ${trader.float_kes.toLocaleString()}`);
      console.log(`   Float TZS: ${trader.float_tzs.toLocaleString()}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ TEST TRADER READY!\n');
    console.log('🚀 NEXT STEPS:\n');
    console.log(`  1. Login at: https://rowan-1-9crb.onrender.com`);
    console.log(`     Email: ${testEmail}`);
    console.log(`     Password: ${testPassword}\n`);
    console.log('  2. Make a cashout request (1-2 XLM)');
    console.log('  3. Trader should be matched automatically');
    console.log('  4. Watch for transaction state transitions\n');
    console.log('='.repeat(70) + '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
