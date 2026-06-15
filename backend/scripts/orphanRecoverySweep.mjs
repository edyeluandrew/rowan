/**
 * Phase 2G — Legacy testnet orphan USDC recovery sweep.
 *
 * Usage (dry-run is the default — no flags needed):
 *   node scripts/orphanRecoverySweep.mjs
 *   node scripts/orphanRecoverySweep.mjs --execute --i-confirm-testnet-only
 *
 * Sends exact per-tx USDC from escrow → TESTNET_RECOVERY_WALLET (not user refund).
 * Marks tx FAILED with failure_reason=legacy_testnet_orphan_recovery.
 * Does NOT mark REFUNDED. Stores admin_recovery_tx (not stellar_refund_tx).
 */
import dotenv from 'dotenv';
import config from '../src/config/index.js';
import db from '../src/db/index.js';
import auditLogService from '../src/services/auditLogService.js';
import stateMachine from '../src/services/transactionStateMachine.js';
import {
  server as horizon,
  USDC_ASSET,
  escrowKeypair,
  networkPassphrase,
  StellarSdk,
} from '../src/config/stellar.js';
import logger from '../src/utils/logger.js';

dotenv.config();

const ORPHAN_STATES = ['TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING'];
const TRADER_EMAIL = 'testuser2@rowan.test';
const FAILURE_REASON = 'legacy_testnet_orphan_recovery';
const PROTECTED_EMAIL_FRAGMENTS = ['ejoku', 'blaire', 'localhost8081'];

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const dryRun = !execute; // default: dry-run only
const confirmed = args.includes('--i-confirm-testnet-only');

if (execute && !confirmed) {
  console.error('Execute requires --i-confirm-testnet-only');
  process.exit(1);
}

if (config.stellar.network !== 'testnet' || config.stellar.isMainnet) {
  console.error('ABORT: STELLAR_NETWORK must be testnet');
  process.exit(1);
}

const recoveryWalletEnv = process.env.TESTNET_RECOVERY_WALLET_PUBLIC_KEY;
if (!recoveryWalletEnv) {
  console.error('ABORT: TESTNET_RECOVERY_WALLET_PUBLIC_KEY is required');
  process.exit(1);
}

function round7(n) {
  return Number(Number(n).toFixed(7));
}

async function horizonTxExists(hash) {
  if (!hash) return false;
  const r = await fetch(`${config.stellar.horizonUrl}/transactions/${hash}`);
  return r.ok;
}

async function accountUsdcTrustline(address) {
  try {
    const acct = await horizon.loadAccount(address);
    const b = acct.balances.find(
      (x) => x.asset_code === USDC_ASSET.code && x.asset_issuer === USDC_ASSET.issuer
    );
    return { exists: true, hasTrustline: !!b, balance: b ? Number(b.balance) : null };
  } catch (e) {
    if (e?.response?.status === 404) return { exists: false, hasTrustline: false };
    throw e;
  }
}

async function escrowUsdcBalance() {
  const acct = await horizon.loadAccount(config.stellar.escrowPublicKey);
  const b = acct.balances.find(
    (x) => x.asset_code === USDC_ASSET.code && x.asset_issuer === USDC_ASSET.issuer
  );
  return b ? Number(b.balance) : 0;
}

async function loadCandidates() {
  const { rows } = await db.query(
    `SELECT t.id, t.state, t.created_at, t.updated_at,
      t.user_id, u.stellar_address AS user_stellar_address, u.email AS user_email,
      t.trader_id, tr.email AS trader_email,
      t.payout_reference, t.stellar_deposit_tx, t.stellar_swap_tx,
      t.stellar_release_tx, t.stellar_refund_tx, t.admin_recovery_tx,
      t.usdc_amount, t.payout_setting_id,
      ps.reserved_float AS setting_reserved_float,
      (SELECT COUNT(*)::int FROM disputes d WHERE d.transaction_id = t.id) AS dispute_count
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    JOIN traders tr ON tr.id = t.trader_id
    LEFT JOIN trader_payout_settings ps ON ps.id = t.payout_setting_id
    WHERE t.state = ANY($1)
      AND tr.email = $2
      AND t.admin_recovery_tx IS NULL
      AND t.stellar_release_tx IS NULL
      AND t.stellar_refund_tx IS NULL
    ORDER BY t.created_at`,
    [ORPHAN_STATES, TRADER_EMAIL]
  );
  return rows;
}

function isProtectedUser(email) {
  if (!email) return false;
  const lower = email.toLowerCase();
  return PROTECTED_EMAIL_FRAGMENTS.some((f) => lower.includes(f));
}

async function buildDryRun(candidates, recoveryWallet) {
  const escrowBefore = await escrowUsdcBalance();
  const recoveryAcct = await accountUsdcTrustline(recoveryWallet);

  const txs = [];
  let totalUsdc = 0;

  for (const tx of candidates) {
    const usdc = round7(tx.usdc_amount);
    totalUsdc += usdc;
    const depositOk = await horizonTxExists(tx.stellar_deposit_tx);
    const swapOk = await horizonTxExists(tx.stellar_swap_tx);
    const releaseOk = await horizonTxExists(tx.stellar_release_tx);
    const refundOk = await horizonTxExists(tx.stellar_refund_tx);
    const floatReserved = tx.setting_reserved_float != null && Number(tx.setting_reserved_float) > 0;

    txs.push({
      transaction_id: tx.id,
      state: tx.state,
      created_at: tx.created_at,
      updated_at: tx.updated_at,
      user_id: tx.user_id,
      user_stellar_address: tx.user_stellar_address,
      user_email: tx.user_email,
      trader_id: tx.trader_id,
      trader_email: tx.trader_email,
      usdc_amount: usdc,
      payout_reference: tx.payout_reference,
      stellar_deposit_tx: tx.stellar_deposit_tx,
      stellar_swap_tx: tx.stellar_swap_tx,
      stellar_release_tx: tx.stellar_release_tx,
      stellar_refund_tx: tx.stellar_refund_tx,
      payout_setting_id: tx.payout_setting_id,
      float_reserved: floatReserved,
      dispute_exists: tx.dispute_count > 0,
      horizon_deposit_ok: depositOk,
      horizon_swap_ok: swapOk,
      horizon_release_ok: releaseOk,
      horizon_refund_ok: refundOk,
      protected_user: isProtectedUser(tx.user_email),
      planned_db_state: 'FAILED',
      planned_failure_reason: FAILURE_REASON,
      planned_audit_actions: ['orphan_recovery_started', 'orphan_recovery_succeeded'],
    });
  }

  return {
    mode: dryRun ? 'dry-run' : 'execute-preview',
    network: config.stellar.network,
    is_testnet: config.stellar.network === 'testnet',
    recovery_wallet: recoveryWallet,
    recovery_wallet_exists: recoveryAcct.exists,
    recovery_wallet_usdc_trustline: recoveryAcct.hasTrustline,
    recovery_wallet_usdc_balance_before: recoveryAcct.balance,
    escrow_usdc_balance_before: escrowBefore,
    transaction_count: txs.length,
    total_usdc_to_recover: round7(totalUsdc),
    expected_count: null,
    expected_total_usdc: null,
    transactions: txs,
  };
}

function validateDryRun(report) {
  const errors = [];

  if (config.stellar.network !== 'testnet' || config.stellar.isMainnet) {
    errors.push('ABORT: STELLAR_NETWORK is not testnet');
  }
  if (!report.recovery_wallet) {
    errors.push('ABORT: TESTNET_RECOVERY_WALLET_PUBLIC_KEY is not configured');
  }
  if (report.transaction_count === 0) {
    return errors; // nothing pending — valid dry-run
  }
  if (!report.recovery_wallet_exists) {
    errors.push('ABORT: recovery wallet account does not exist on Horizon');
  }
  if (!report.recovery_wallet_usdc_trustline) {
    errors.push('ABORT: recovery wallet missing USDC trustline');
  }
  if (report.escrow_usdc_balance_before < report.total_usdc_to_recover) {
    errors.push('ABORT: escrow USDC insufficient for sweep');
  }

  for (const tx of report.transactions) {
    if (tx.protected_user) errors.push(`ABORT: protected user on tx ${tx.transaction_id}`);
    if (tx.trader_email !== TRADER_EMAIL) errors.push(`ABORT: wrong trader on ${tx.transaction_id}`);
    if (tx.dispute_exists) errors.push(`ABORT: dispute on ${tx.transaction_id}`);
    if (tx.horizon_release_ok || tx.horizon_refund_ok) errors.push(`ABORT: release/refund on chain ${tx.transaction_id}`);
    if (tx.stellar_release_tx || tx.stellar_refund_tx) errors.push(`ABORT: release/refund hash in DB ${tx.transaction_id}`);
    if (tx.payout_setting_id) errors.push(`ABORT: payout_setting_id set ${tx.transaction_id}`);
    if (tx.float_reserved) errors.push(`ABORT: float reserved ${tx.transaction_id}`);
    if (!tx.horizon_deposit_ok || !tx.horizon_swap_ok) errors.push(`ABORT: missing deposit/swap ${tx.transaction_id}`);
    if (!tx.usdc_amount || tx.usdc_amount <= 0) errors.push(`ABORT: invalid USDC ${tx.transaction_id}`);
    if (!ORPHAN_STATES.includes(tx.state)) errors.push(`ABORT: unexpected state ${tx.state} on ${tx.transaction_id}`);
  }

  return errors;
}

async function sendRecoveryUsdc(destination, amount, txId) {
  if (!escrowKeypair) throw new Error('Escrow keypair not configured');
  const escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);
  const memo = `ORPHAN-${txId.replace(/-/g, '').slice(0, 12)}`;

  const built = new StellarSdk.TransactionBuilder(escrowAccount, {
    fee: config.stellarMaxFee,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination,
        asset: USDC_ASSET,
        amount: round7(amount).toFixed(7),
      })
    )
    .addMemo(StellarSdk.Memo.text(memo.slice(0, 28)))
    .setTimeout(30)
    .build();

  built.sign(escrowKeypair);
  const result = await horizon.submitTransaction(built);
  return { hash: result.hash, memo };
}

async function executeRecovery(report, recoveryWallet) {
  const results = { recovered: [], failed: [], skipped: [] };

  await auditLogService.log({
    actor_role: 'system',
    action: 'orphan_recovery_batch_started',
    resource_type: 'orphan_recovery',
    metadata: {
      transaction_count: report.transaction_count,
      total_usdc: report.total_usdc_to_recover,
      recovery_wallet: recoveryWallet,
      network: config.stellar.network,
    },
  });

  for (const tx of report.transactions) {
    const txId = tx.transaction_id;

    // Idempotency re-check
    const fresh = await db.query(
      `SELECT id, state, admin_recovery_tx, usdc_amount FROM transactions WHERE id = $1`,
      [txId]
    );
    const row = fresh.rows[0];
    if (!row) {
      results.failed.push({ txId, error: 'not_found' });
      continue;
    }
    if (row.admin_recovery_tx) {
      results.skipped.push({ txId, reason: 'already_recovered', hash: row.admin_recovery_tx });
      continue;
    }
    if (row.state === 'FAILED' && row.admin_recovery_tx) {
      results.skipped.push({ txId, reason: 'already_failed_with_recovery' });
      continue;
    }

    await auditLogService.log({
      actor_role: 'system',
      action: 'orphan_recovery_started',
      resource_type: 'transaction',
      resource_id: txId,
      metadata: {
        transaction_id: txId,
        user_id: tx.user_id,
        user_stellar_address: tx.user_stellar_address,
        amount_usdc: tx.usdc_amount,
        recovery_wallet: recoveryWallet,
        from_state: tx.state,
      },
    });

    let recoveryHash;
    try {
      const payment = await sendRecoveryUsdc(recoveryWallet, tx.usdc_amount, txId);
      recoveryHash = payment.hash;
    } catch (err) {
      logger.error(`[OrphanRecovery] Payment failed for ${txId}:`, err.message);
      await auditLogService.log({
        actor_role: 'system',
        action: 'orphan_recovery_failed',
        resource_type: 'transaction',
        resource_id: txId,
        metadata: {
          transaction_id: txId,
          user_id: tx.user_id,
          user_stellar_address: tx.user_stellar_address,
          amount_usdc: tx.usdc_amount,
          recovery_wallet: recoveryWallet,
          error: err.message,
        },
      });
      results.failed.push({ txId, error: err.message });
      continue;
    }

    const updated = await stateMachine.transition(txId, tx.state, 'FAILED', {
      failure_reason: FAILURE_REASON,
      admin_recovery_tx: recoveryHash,
      admin_recovery_wallet: recoveryWallet,
    });

    if (!updated) {
      await auditLogService.log({
        actor_role: 'system',
        action: 'orphan_recovery_failed',
        resource_type: 'transaction',
        resource_id: txId,
        metadata: {
          transaction_id: txId,
          recovery_tx_hash: recoveryHash,
          error: 'state_transition_failed_after_on_chain_payment',
          note: 'MANUAL REVIEW REQUIRED — USDC sent but DB not updated',
        },
      });
      results.failed.push({ txId, error: 'state_transition_failed', recoveryHash });
      continue;
    }

    await db.query(
      `UPDATE transactions SET admin_recovery_at = NOW() WHERE id = $1`,
      [txId]
    );

    await auditLogService.log({
      actor_role: 'system',
      action: 'orphan_recovery_succeeded',
      resource_type: 'transaction',
      resource_id: txId,
      old_value: { state: tx.state },
      new_value: { state: 'FAILED', failure_reason: FAILURE_REASON },
      metadata: {
        transaction_id: txId,
        user_id: tx.user_id,
        user_stellar_address: tx.user_stellar_address,
        amount_usdc: tx.usdc_amount,
        recovery_wallet: recoveryWallet,
        recovery_tx_hash: recoveryHash,
      },
    });

    results.recovered.push({ txId, recoveryHash, usdc: tx.usdc_amount });
  }

  await auditLogService.log({
    actor_role: 'system',
    action: 'orphan_recovery_batch_finished',
    resource_type: 'orphan_recovery',
    metadata: {
      recovered_count: results.recovered.length,
      failed_count: results.failed.length,
      skipped_count: results.skipped.length,
      recovery_hashes: results.recovered.map((r) => r.recoveryHash),
    },
  });

  return results;
}

async function main() {
  const recoveryWallet = recoveryWalletEnv;
  const candidates = await loadCandidates();
  const report = await buildDryRun(candidates, recoveryWallet);
  const errors = validateDryRun(report);

  report.validation_errors = errors;
  report.validation_passed = errors.length === 0;
  report.planned_db_state = 'FAILED';
  report.planned_audit_action_names = [
    'orphan_recovery_batch_started',
    'orphan_recovery_started',
    'orphan_recovery_succeeded',
    'orphan_recovery_failed',
    'orphan_recovery_batch_finished',
  ];

  console.log(JSON.stringify(report, null, 2));

  console.error('\n--- DRY-RUN SUMMARY ---');
  console.error(`Network: ${report.network}`);
  console.error(`Pending orphans: ${report.transaction_count}`);
  console.error(`Total USDC to recover: ${report.total_usdc_to_recover}`);
  console.error(`Recovery wallet: ${report.recovery_wallet}`);
  console.error(`Validation passed: ${report.validation_passed}`);

  if (!report.validation_passed) {
    console.error('\nDRY RUN FAILED — not executing');
    process.exit(1);
  }

  if (dryRun) {
    if (report.transaction_count === 0) {
      console.error('\nDRY RUN PASSED — no pending orphans (all recovered or none match)');
    } else {
      console.error('\nDRY RUN PASSED — add --execute --i-confirm-testnet-only to perform recovery');
    }
    process.exit(0);
  }

  // Re-run validation at execute time (must match dry-run snapshot)
  const candidates2 = await loadCandidates();
  const report2 = await buildDryRun(candidates2, recoveryWallet);
  const errors2 = validateDryRun(report2);
  if (errors2.length > 0) {
    console.error('EXECUTE ABORTED — dry run no longer matches:', errors2);
    process.exit(1);
  }
  if (report2.transaction_count === 0) {
    console.error('EXECUTE ABORTED — no pending orphans');
    process.exit(0);
  }

  console.error('\n--- EXECUTING RECOVERY ---');
  console.error(`Transactions: ${report2.transaction_count}, USDC: ${report2.total_usdc_to_recover}`);

  const execResults = await executeRecovery(report2, recoveryWallet);

  const escrowAfter = await escrowUsdcBalance();
  const recoveryAfter = await accountUsdcTrustline(recoveryWallet);

  console.log(JSON.stringify({
    execute_results: execResults,
    escrow_usdc_after: escrowAfter,
    recovery_wallet_usdc_after: recoveryAfter.balance,
    escrow_usdc_delta: round7(report2.escrow_usdc_balance_before - escrowAfter),
  }, null, 2));

  if (execResults.failed.length > 0) process.exit(2);
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
