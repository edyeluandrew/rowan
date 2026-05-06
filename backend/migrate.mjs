#!/usr/bin/env node

/**
 * Migration runner - Load .env and execute SQL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const [key, ...valueParts] = line.split('=');
    let value = valueParts.join('=');
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    env[key] = value;
  });
  
  return env;
}

const env = loadEnv();
const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[ERROR] DATABASE_URL not found in .env');
  process.exit(1);
}

console.log('[Info] Using DATABASE_URL from .env');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting Phase 3 migration...');
    console.log('[Migration] Adding payout_setting_id column to transactions table');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260506_add_payout_setting_id_to_transactions.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration
    await client.query(migrationSql);
    
    console.log('[Migration] ✅ SQL executed successfully!');
    
    // Verify column exists
    const result = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'transactions' AND column_name = 'payout_setting_id'`
    );
    
    if (result.rows.length > 0) {
      console.log('[Migration] ✅ Verified: payout_setting_id column exists');
      console.log(`[Migration]    Type: ${result.rows[0].data_type}`);
    } else {
      console.log('[Migration] ⚠️ Column verification failed');
    }
    
  } catch (err) {
    if (err.message.includes('already exists') && err.message.includes('column')) {
      console.log('[Migration] ℹ️ Column already exists (idempotent operation)');
    } else {
      console.error('[ERROR] Migration failed:', err.message);
      console.error(err.code, err.detail);
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().then(() => {
  console.log('[Done] Migration process complete');
  process.exit(0);
});
