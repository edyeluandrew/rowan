/**
 * Migration Runner
 * Executes SQL migration files against the database
 */

import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  statement_timeout: 60000,
});

async function createMigrationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Migrations table exists');
  } catch (err) {
    console.error('Error creating migrations table:', err.message);
    console.error('Full error:', err);
    throw err;
  }
}

async function getMigrationsRun() {
  try {
    const result = await pool.query(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    return new Set(result.rows.map(row => row.filename));
  } catch (err) {
    console.error('Error fetching migration history:', err.message);
    throw err;
  }
}

async function recordMigration(filename) {
  try {
    await pool.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
      [filename]
    );
  } catch (err) {
    console.error(`Error recording migration ${filename}:`, err.message);
    throw err;
  }
}

async function runMigration(filename, sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Split by statements and execute each
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`  Executing ${statements.length} statement(s)...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await client.query(statement);
      } catch (err) {
        console.error(`  Statement ${i + 1} failed:`, err.message.substring(0, 100));
        throw err;
      }
    }

    await recordMigration(filename);
    await client.query('COMMIT');
    
    console.log(`✓ ${filename}`);
    return true;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Ignore rollback errors
    }
    console.error(`✗ ${filename}: ${err.message.substring(0, 150)}`);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🔄 Running migrations...\n');
    console.log('Database URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

    // Create migrations table
    await createMigrationsTable();

    // Get list of already-run migrations
    const ran = await getMigrationsRun();

    // Get all migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files\n`);

    let executed = 0;
    for (const file of files) {
      if (ran.has(file)) {
        console.log(`⊘ ${file} (already run)`);
        continue;
      }

      console.log(`\n▶ ${file}`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await runMigration(file, sql);
        executed++;
      } catch (err) {
        // Continue to next migration even if one fails
        console.log(`⚠ Continuing with next migration...`);
      }
    }

    console.log(`\n✓ Migration complete. Executed: ${executed}, Skipped: ${ran.size}`);

  } catch (err) {
    console.error('\n✗ Initial setup failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
