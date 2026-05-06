#!/usr/bin/env node

/**
 * Check payout_settings table schema
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

async function checkSchema() {
  const client = await pool.connect();
  try {
    console.log('[Schema] Payout_settings table columns:');
    const result = await client.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'trader_payout_settings' 
       ORDER BY ordinal_position`
    );
    
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable=${col.is_nullable})`);
    });
    
    console.log('\n[Schema] Payout_settings table sample:');
    const sample = await client.query(`SELECT * FROM trader_payout_settings LIMIT 1`);
    if (sample.rows.length > 0) {
      console.log(JSON.stringify(sample.rows[0], null, 2));
    } else {
      console.log('  (No payout settings in database)');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema().catch(err => {
  console.error('[Error]', err.message);
  process.exit(1);
});
