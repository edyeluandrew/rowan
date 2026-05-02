import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const email = 'testuser2@rowan.test';
const newPassword = 'TestUser2!Pass123';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const hash = await bcrypt.hash(newPassword, 12);
const r = await c.query(
  `UPDATE traders SET password_hash = $1, updated_at = NOW()
   WHERE email = $2
   RETURNING id, name, email`,
  [hash, email]
);

if (r.rows[0]) {
  console.log('\n✅ Password reset successful\n');
  console.log(`  Email:    ${r.rows[0].email}`);
  console.log(`  Password: ${newPassword}`);
  console.log(`  Trader:   ${r.rows[0].name} (${r.rows[0].id})\n`);
} else {
  console.log('❌ No trader found with that email');
}

await c.end();
