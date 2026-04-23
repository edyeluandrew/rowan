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

    const res = await client.query(
      `SELECT id, name, email, is_active, float_ugx, float_kes, float_tzs, 
              daily_limit, trust_score, created_at
       FROM traders 
       WHERE email = $1`,
      [email]
    );

    if (res.rows.length === 0) {
      console.error('❌ Trader not found');
      return;
    }

    const t = res.rows[0];

    console.log('\n✅ TRADER VERIFICATION:\n');
    console.log('='.repeat(80));
    console.log(`\n📋 Basic Info:`);
    console.log(`   Name: ${t.name}`);
    console.log(`   Email: ${t.email}`);
    console.log(`   ID: ${t.id}`);
    
    console.log(`\n⚙️  Status & Conditions:`);
    console.log(`   ✅ Is Active: ${t.is_active ? 'YES' : 'NO'}`);
    console.log(`   ✅ Trust Score: ${t.trust_score} (requires 100+)`);
    console.log(`   ✅ Daily Limit: UGX ${t.daily_limit?.toLocaleString() || 'N/A'}`);
    
    console.log(`\n💰 Float Balance:`);
    console.log(`   UGX Float: UGX ${t.float_ugx?.toLocaleString() || 0} (1M required)`);
    console.log(`   KES Float: KES ${t.float_kes?.toLocaleString() || 0} (1M required)`);
    console.log(`   TZS Float: TZS ${t.float_tzs?.toLocaleString() || 0} (1M required)`);

    // Check if conditions are met
    const isReady = 
      t.is_active && 
      t.trust_score >= 100 && 
      t.float_ugx >= 1000000 &&
      t.float_kes >= 1000000 &&
      t.float_tzs >= 1000000;

    console.log(`\n${isReady ? '🟢' : '🔴'} READY FOR CASHOUT: ${isReady ? 'YES' : 'NO'}`);
    console.log('\n' + '='.repeat(80) + '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
