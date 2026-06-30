#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error('DATABASE_URL not set in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

const sql = fs.readFileSync(path.join(root, 'src/db/migrations/039_p2p_buy.sql'), 'utf-8');

const client = await pool.connect();
try {
  console.log('[039] Running p2p_buy migration...');
  await client.query(sql);
  const check = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'trader_payout_settings' AND column_name = 'ad_side'`
  );
  console.log('[039] Done. ad_side column exists:', check.rows.length > 0);
} catch (err) {
  console.error('[039] Failed:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
