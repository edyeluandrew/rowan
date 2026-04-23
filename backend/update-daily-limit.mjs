import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();

    const email = 'edyelu3@gmail.com';
    const newDailyLimit = 100000000; // 100M UGX

    console.log(`\n🔄 Updating daily limit to 100M UGX...\n`);

    const res = await client.query(
      `UPDATE traders 
       SET daily_limit = $1, updated_at = NOW()
       WHERE email = $2
       RETURNING name, email, daily_limit, float_ugx, float_kes, float_tzs`,
      [newDailyLimit, email]
    );

    if (res.rows.length === 0) {
      console.error('❌ Trader not found');
      return;
    }

    const trader = res.rows[0];
    console.log('✅ DAILY LIMIT UPDATED:\n');
    console.log(`   Name: ${trader.name}`);
    console.log(`   Email: ${trader.email}`);
    console.log(`   Daily Limit: UGX ${trader.daily_limit.toLocaleString()}`);
    console.log(`   Float UGX: UGX ${trader.float_ugx.toLocaleString()}`);
    console.log(`   Float KES: KES ${trader.float_kes.toLocaleString()}`);
    console.log(`   Float TZS: TZS ${trader.float_tzs.toLocaleString()}`);
    console.log(`\n✅ Trader fully configured for production!\n`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
