#!/usr/bin/env node
/**
 * Seed an admin user from environment variables.
 * Usage: ADMIN_EMAIL=admin@rowan.io ADMIN_PASSWORD=secret node scripts/seedAdmin.js
 */
import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env or environment');
    process.exit(1);
  }

  const existing = await pool.query(`SELECT id FROM users WHERE email = $1 AND role = 'admin'`, [email]);
  if (existing.rows.length > 0) {
    console.log('Admin account already exists');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (stellar_address, phone_hash, email, password_hash, role, kyc_level, created_at)
     VALUES ('ADMIN_PLACEHOLDER', 'admin', $1, $2, 'admin', 'VERIFIED', NOW())
     ON CONFLICT DO NOTHING`,
    [email, passwordHash]
  );

  console.log(`Admin account seeded: ${email}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
