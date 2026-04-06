/**
 * cleanup: Remove all mock/test transactions from the database
 * Usage: node scripts/cleanupMockTransactions.mjs
 */

import dotenv from 'dotenv';
dotenv.config();

import db from '../src/db/index.js';
import logger from '../src/utils/logger.js';

async function cleanupMockTransactions() {
  try {
    console.log('🧹 Starting cleanup of mock transactions...\n');

    // Delete all transactions with "REFUNDED" state (mock data indicator)
    // These are the test transactions shown in the admin panel
    const result = await db.query(
      `DELETE FROM transactions 
       WHERE state = 'REFUNDED'
       RETURNING id, usdc_amount, state, created_at`
    );

    const deletedTx = result.rows;
    console.log(`✅ Deleted ${deletedTx.length} mock transactions:\n`);
    
    deletedTx.forEach(tx => {
      console.log(`  • ID: ${tx.id}`);
      console.log(`    Amount: ${tx.usdc_amount} USDC | State: ${tx.state} | Created: ${tx.created_at}\n`);
    });

    console.log(`\n✨ Cleanup complete! ${deletedTx.length} mock transactions removed.\n`);

    // Show remaining transaction count
    const countResult = await db.query('SELECT COUNT(*) as total FROM transactions');
    console.log(`📊 Total transactions remaining: ${countResult.rows[0].total}\n`);

    process.exit(0);
  } catch (error) {
    logger.error('Cleanup failed:', error);
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupMockTransactions();
