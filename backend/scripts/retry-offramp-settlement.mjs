/**
 * Retry offramp settlement for a stuck ESCROW_LOCKED transaction.
 * Usage: DOTENV_CONFIG_PATH=.env.staging node -r dotenv/config scripts/retry-offramp-settlement.mjs <txId>
 */
import paymentExecutor from '../src/services/payments/paymentExecutor.js';
import db from '../src/db/index.js';

const txId = process.argv[2];
if (!txId) {
  console.error('Usage: retry-offramp-settlement.mjs <transactionId>');
  process.exit(1);
}

try {
  const before = await db.query(
    `SELECT id, state, payout_provider, trader_id FROM transactions WHERE id = $1`,
    [txId]
  );
  console.log('Before:', before.rows[0]);

  const result = await paymentExecutor.settleOfframpPayout(txId);
  console.log('Result:', result);

  const after = await db.query(
    `SELECT id, state, payout_provider, payment_rail, aggregator_ref, trader_id, failure_reason
     FROM transactions WHERE id = $1`,
    [txId]
  );
  console.log('After:', after.rows[0]);
} catch (err) {
  console.error('Error:', err.message);
  if (err.body) console.error('Body:', err.body);
  process.exit(1);
} finally {
  await db.pool.end();
}
