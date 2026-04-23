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

    console.log('\n📊 TRADERS AVAILABLE:\n');
    console.log('='.repeat(80));

    const res = await client.query(
      `SELECT id, name, email, is_active, float_ugx, float_kes, float_tzs, 
              trust_score
       FROM traders 
       ORDER BY created_at DESC`
    );

    if (res.rows.length === 0) {
      console.log('  No traders found\n');
      return;
    }

    res.rows.forEach((t, i) => {
      console.log(`\n${i + 1}. ${t.name}`);
      console.log(`   📧 Email: ${t.email}`);
      console.log(`   🆔 ID: ${t.id}`);
      console.log(`   ✅ Status: ${t.is_active ? 'ACTIVE' : 'INACTIVE'}`);
      console.log(`   💰 Float UGX: ${t.float_ugx.toLocaleString()}`);
      console.log(`   💰 Float KES: ${t.float_kes.toLocaleString()}`);
      console.log(`   💰 Float TZS: ${t.float_tzs.toLocaleString()}`);
      console.log(`   ⭐ Trust Score: ${t.trust_score}`);
    });

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
