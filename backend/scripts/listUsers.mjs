import db from '../src/db/index.js';

const result = await db.query(
  `SELECT id, created_at FROM users ORDER BY created_at DESC LIMIT 20`
);

console.log(`\n✅ Found ${result.rows.length} users:\n`);
result.rows.forEach((user, i) => {
  console.log(`${i + 1}. ID: ${user.id}`);
  console.log(`   Created: ${new Date(user.created_at).toLocaleString()}\n`);
});

process.exit(0);
