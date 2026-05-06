#!/usr/bin/env node

/**
 * Verify Phase 3 migration was applied
 */

import db from './src/db/index.js';
import logger from './src/utils/logger.js';

async function verify() {
  try {
    logger.info('[Verify] Checking if payout_setting_id column exists...');
    
    const result = await db.query(
      `SELECT EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'payout_setting_id'
      )`
    );
    
    const columnExists = result.rows[0].exists;
    
    if (columnExists) {
      logger.info('[Verify] ✅ payout_setting_id column exists!');
      
      // Get column info
      const colInfo = await db.query(
        `SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'payout_setting_id'`
      );
      
      if (colInfo.rows.length > 0) {
        const col = colInfo.rows[0];
        logger.info(`[Verify] Column info: ${col.column_name} (${col.data_type}, nullable=${col.is_nullable})`);
      }
      
      // Check index
      const indexResult = await db.query(
        `SELECT 1 FROM pg_indexes 
        WHERE tablename = 'transactions' 
        AND indexname = 'idx_transactions_payout_setting'`
      );
      
      if (indexResult.rows.length > 0) {
        logger.info('[Verify] ✅ Index idx_transactions_payout_setting exists!');
      } else {
        logger.warn('[Verify] ⚠️ Index idx_transactions_payout_setting not found');
      }
      
      process.exit(0);
    } else {
      logger.error('[Verify] ❌ payout_setting_id column does not exist!');
      process.exit(1);
    }
  } catch (err) {
    logger.error('[Verify] Error:', err.message);
    process.exit(1);
  }
}

verify();
