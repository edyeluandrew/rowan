import pg from 'pg';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

// [P3 FIX] Reduced pool size — Supabase free tier allows ~60 connections total
// SSL is required for Supabase (even in development) — detect from connection string
const needsSsl = config.databaseUrl?.includes('supabase.com') || config.databaseUrl?.includes('supabase.co') || config.nodeEnv === 'production';

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // 30s — Supabase free-tier can take 15-20s to wake from pause
});

pool.on('error', (err) => {
  logger.error('[DB] Unexpected pool error:', { error: err.message });
});


/**
 * Run a single query.
 * Usage: db.query('SELECT * FROM users WHERE id = $1', [userId])
 */

const query = (text, params) => pool.query(text, params);

/**
 * Grab a client from the pool for multi-statement transactions.
 * Usage:
 *   const client = await db.getClient();
 *   try { await client.query('BEGIN'); ... await client.query('COMMIT'); }
 *   catch (e) { await client.query('ROLLBACK'); throw e; }
 *   finally { client.release(); }
 */
const getClient = () => pool.connect();

export default { query, getClient, pool };
