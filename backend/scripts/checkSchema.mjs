import db from '../src/db/index.js';

const result = await db.query(
  `SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_name = 'transactions' ORDER BY ordinal_position`
);

console.log('\n📊 Transactions Table Schema:');
result.rows.forEach(row => {
  console.log(`  ${row.column_name}: ${row.data_type}`);
});

process.exit(0);
