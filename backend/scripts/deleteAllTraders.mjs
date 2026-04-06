/**
 * cleanup: Remove all test traders from the database
 * Usage: node scripts/deleteAllTraders.mjs
 */

import db from '../src/db/index.js';
import logger from '../src/utils/logger.js';

async function deleteAllTraders() {
  try {
    console.log('🧹 Starting cleanup of test traders...\n');

    // Get trader info before deletion
    const selectResult = await db.query(
      `SELECT id, name, email, verification_status FROM traders ORDER BY created_at`
    );

    const tradersToDelete = selectResult.rows;

    // Delete all traders
    const deleteResult = await db.query(
      `DELETE FROM traders 
       RETURNING id, name, email, verification_status, created_at`
    );

    const deletedTraders = deleteResult.rows;

    console.log(`✅ Deleted ${deletedTraders.length} traders:\n`);
    
    deletedTraders.forEach((trader, i) => {
      console.log(`${i + 1}. ${trader.name}`);
      console.log(`   Email: ${trader.email}`);
      console.log(`   Status: ${trader.verification_status}`);
      console.log(`   Created: ${trader.created_at}\n`);
    });

    console.log(`\n✨ Cleanup complete! ${deletedTraders.length} test traders removed.\n`);

    process.exit(0);
  } catch (error) {
    logger.error('Cleanup failed:', error);
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteAllTraders();
