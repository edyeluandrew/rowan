#!/usr/bin/env node

/**
 * Simple migration runner - Execute SQL file directly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[ERROR] DATABASE_URL environment variable not set');
  process.exit(1);
}

console.log('[Info] DATABASE_URL:', databaseUrl.substring(0, 50) + '...');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting Phase 3 migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260506_add_payout_setting_id_to_transactions.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    console.log('[Migration] Read migration file:', migrationPath);
    
    // Execute the entire migration as a single statement
    console.log('[Migration] Executing SQL...');
    await client.query(migrationSql);
    
    console.log('[Migration] ✅ Migration completed successfully!');
  } catch (err) {
    // Check if it's an idempotent error
    if (err.message.includes('already exists')) {
      console.log('[Migration] ⚠️ Column/index already exists (idempotent)');
    } else {
      console.error('[ERROR] Migration failed:', err.message);
      console.error(err);
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().then(() => process.exit(0));
