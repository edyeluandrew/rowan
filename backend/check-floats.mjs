#!/usr/bin/env node

/**
 * Check payout setting float values
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const [key, ...valueParts] = line.split('=');
    let value = valueParts.join('=');
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  
  return env;
}

const env = loadEnv();
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const client = await pool.connect();
  try {
    console.log('[Info] Checking payout settings float values:');
    const result = await client.query(
      `SELECT id, trader_id, network, currency, available_float, reserved_float 
       FROM trader_payout_settings 
       LIMIT 3`
    );
    
    result.rows.forEach(row => {
      console.log(`  PS: ${row.id.substring(0, 8)}...`);
      console.log(`    Network: ${row.network}, Currency: ${row.currency}`);
      console.log(`    Available: ${row.available_float}, Reserved: ${row.reserved_float}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(err => {
  console.error('[Error]', err.message);
  process.exit(1);
});
