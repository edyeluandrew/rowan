#!/usr/bin/env node

/**
 * Migration runner for Phase 3: Trader Float Reservation Lifecycle
 * Executes: 20260506_add_payout_setting_id_to_transactions.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './src/db/index.js';
import logger from './src/utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  try {
    logger.info('[Migration] Starting Phase 3 migration: Add payout_setting_id to transactions');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260506_add_payout_setting_id_to_transactions.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split SQL statements and filter empty ones
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    logger.info(`[Migration] Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      logger.info(`[Migration] Executing statement ${i + 1}/${statements.length}...`);
      logger.debug(`[Migration] SQL: ${stmt.substring(0, 100)}...`);
      
      try {
        await db.query(stmt);
        logger.info(`[Migration] ✅ Statement ${i + 1} completed`);
      } catch (err) {
        // Check if error is due to column already existing (idempotent)
        if (err.message.includes('column "payout_setting_id" of relation "transactions" already exists')) {
          logger.warn(`[Migration] Column already exists (idempotent) — skipping`);
        } else if (err.message.includes('already exists') && err.message.includes('idx_transactions_payout_setting')) {
          logger.warn(`[Migration] Index already exists (idempotent) — skipping`);
        } else {
          throw err;
        }
      }
    }
    
    logger.info('[Migration] ✅ Phase 3 migration completed successfully!');
    process.exit(0);
  } catch (err) {
    logger.error('[Migration] ❌ Migration failed:', err.message);
    logger.error(err.stack);
    process.exit(1);
  }
}

runMigration();
