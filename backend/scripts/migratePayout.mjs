/**
 * Direct SQL Execution for Payout Settings Migration
 * Bypasses the connection pool for faster execution
 */

import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIGRATION_FILE = path.join(__dirname, '../supabase/migrations/20260506_trader_payout_settings.sql');

async function executeMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    application_name: 'rowan-migration',
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✓ Connected\n');

    console.log('📖 Reading migration file...');
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    
    // Split statements more carefully, preserving comments
    const statements = [];
    let currentStatement = '';
    const lines = sql.split('\n');
    
    for (const line of lines) {
      // Skip comment-only lines
      if (line.trim().startsWith('--')) {
        currentStatement += line + '\n';
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Check if line ends with semicolon (not in comment)
      const beforeComment = line.split('--')[0];
      if (beforeComment.trim().endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt.length > 0) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }

    // Filter out empty and comment-only statements
    const validStatements = statements
      .filter(s => s.length > 0 && !s.split('\n')[s.split('\n').length - 1].trim().startsWith('--'));

    console.log(`✓ Found ${validStatements.length} statements\n`);

    console.log('🚀 Executing migration...\n');

    for (let i = 0; i < validStatements.length; i++) {
      const stmt = validStatements[i];
      const lines = stmt.split('\n').filter(l => !l.trim().startsWith('--'));
      const preview = lines[0].substring(0, 60).replace(/\n/g, ' ');
      
      try {
        await client.query(stmt);
        console.log(`  ✓ [${i + 1}/${validStatements.length}] ${preview}${preview.length >= 60 ? '...' : ''}`);
      } catch (err) {
        // If it's an "already exists" error, that's OK
        if (err.message.includes('already exists') || err.code === '42P07') {
          console.log(`  ⊘ [${i + 1}/${validStatements.length}] ${preview}... (already exists)`);
        } else {
          console.error(`  ✗ [${i + 1}/${validStatements.length}] FAILED`);
          console.error(`    Error: ${err.message}`);
          throw err;
        }
      }
    }

    // Record the migration
    console.log('\n📝 Recording migration...');
    await client.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
      ['20260506_trader_payout_settings.sql']
    );
    console.log('✓ Migration recorded\n');

    console.log('✅ Migration complete!');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeMigration();
