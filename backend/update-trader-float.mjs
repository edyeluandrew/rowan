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
    const newFloat = 1000000;

    console.log(`\n🔄 Updating trader at ${email} float to 1M UGX...\n`);

    const res = await client.query(
      `UPDATE traders 
       SET float_ugx = $1, float_kes = $1, float_tzs = $1, updated_at = NOW()
       WHERE email = $2
       RETURNING id, name, email, float_ugx, float_kes, float_tzs`,
      [newFloat, email]
    );

    if (res.rows.length === 0) {
      console.error('❌ Trader not found');
      return;
    }

    const trader = res.rows[0];
    console.log('✅ TRADER UPDATED:\n');
    console.log(`   Name: ${trader.name}`);
    console.log(`   Email: ${trader.email}`);
    console.log(`   Float UGX: ${trader.float_ugx.toLocaleString()}`);
    console.log(`   Float KES: ${trader.float_kes.toLocaleString()}`);
    console.log(`   Float TZS: ${trader.float_tzs.toLocaleString()}`);
    console.log(`\n✅ Ready for cashout testing!\n`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
