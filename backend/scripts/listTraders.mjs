import db from '../src/db/index.js';

const result = await db.query(
  `SELECT id, name, email, stellar_address, verification_status, is_active, is_suspended, created_at 
   FROM traders 
   ORDER BY created_at DESC`
);

console.log('\n📊 All Traders in Database:\n');

if (result.rows.length === 0) {
  console.log('❌ NO TRADERS FOUND IN DATABASE\n');
} else {
  console.log(`✅ Found ${result.rows.length} traders:\n`);
  result.rows.forEach((trader, i) => {
    console.log(`${i + 1}. ${trader.name}`);
    console.log(`   Email: ${trader.email}`);
    console.log(`   Stellar: ${trader.stellar_address?.slice(0, 20)}...`);
    console.log(`   Status: ${trader.verification_status} | Active: ${trader.is_active ? '✅' : '❌'} | Suspended: ${trader.is_suspended ? '🚫' : '✅'}`);
    console.log(`   Created: ${trader.created_at}\n`);
  });
}

process.exit(0);
