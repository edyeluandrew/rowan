import db from './src/db/index.js';

const r = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`);
console.log('=== USERS ===');
r.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

const r2 = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'traders' ORDER BY ordinal_position`);
console.log('=== TRADERS ===');
r2.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

const r3 = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position`);
console.log('=== TRANSACTIONS ===');
r3.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

const r4 = await db.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('users','traders','transactions','quotes','disputes') ORDER BY tablename, indexname`);
console.log('=== INDEXES ===');
r4.rows.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));

await db.pool.end();
