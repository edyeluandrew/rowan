import { server as horizon, USDC_ASSET } from '../config/stellar.js';
import config from '../config/index.js';
import db from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * Escrow reconciliation — compares on-chain escrow USDC against the DB
 * "escrow liability" (sum of in-flight transaction USDC that Rowan is holding
 * on behalf of users/partners). This is the money-safety keystone: on-chain
 * USDC should always be >= what the ledger says is locked. A negative or
 * out-of-tolerance drift means a bug, a missed release/refund, or worse.
 *
 * Read-only and fully defensive: any single failure is surfaced as a warning
 * rather than throwing, so the report always returns something actionable.
 */

// States where USDC is genuinely locked in escrow and owed to someone.
const IN_FLIGHT_STATES = [
  'ESCROW_LOCKED',
  'TRADER_MATCHED',
  'FIAT_PAYOUT_SUBMITTED',
  'USER_CONFIRMATION_PENDING',
  'DISPUTE_OPENED',
  'DISPUTE_REFUND_PENDING',
  'DISPUTE_RELEASE_PENDING',
  'RELEASE_BLOCKED',
];

// Allowed drift (on-chain minus liability) before we flag. On-chain is expected
// to be slightly HIGHER (dust, unreleased fees), never lower than liability.
const DRIFT_TOLERANCE = parseFloat(process.env.RECON_USDC_DRIFT_TOLERANCE) || 0.5;

function usdcBalanceOf(account) {
  if (!account?.balances) return null;
  const b = account.balances.find(
    (x) => x.asset_code === USDC_ASSET.code && x.asset_issuer === USDC_ASSET.issuer
  );
  return b ? Number(b.balance) : null; // null = no trustline
}

async function loadOnChainEscrowUsdc() {
  const pub = config.stellar.escrowPublicKey;
  if (!pub) return { ok: false, reason: 'not_configured', usdc: null };
  try {
    const acct = await horizon.loadAccount(pub);
    return { ok: true, usdc: usdcBalanceOf(acct) };
  } catch (e) {
    const notFound = e?.response?.status === 404 || /not found/i.test(e.message || '');
    return { ok: false, reason: notFound ? 'not_found' : 'load_failed', usdc: null, error: e.message };
  }
}

/**
 * Build the escrow reconciliation report.
 * @returns {Promise<object>} structured report with drift + per-state breakdown
 */
export async function getEscrowReconciliation() {
  const warnings = [];
  const criticals = [];

  // ── On-chain escrow USDC ──
  const chain = await loadOnChainEscrowUsdc();
  const onChainUsdc = chain.ok ? chain.usdc : null;
  if (!chain.ok) {
    warnings.push(`Could not read on-chain escrow USDC (${chain.reason})`);
  } else if (onChainUsdc === null) {
    criticals.push('Escrow account has no USDC trustline');
  }

  // ── DB escrow liability (in-flight) with per-state breakdown ──
  let dbLiability = 0;
  let byState = {};
  let inFlightCount = 0;
  try {
    const r = await db.query(
      `SELECT state,
              COUNT(*)::int AS count,
              COALESCE(SUM(usdc_amount), 0) AS usdc
       FROM transactions
       WHERE state = ANY($1)
       GROUP BY state`,
      [IN_FLIGHT_STATES]
    );
    for (const row of r.rows) {
      const usdc = parseFloat(row.usdc) || 0;
      byState[row.state] = { count: row.count, usdc };
      dbLiability += usdc;
      inFlightCount += row.count;
    }
  } catch (e) {
    logger.error('[Recon] liability query failed:', e.message);
    warnings.push('Could not read DB escrow liability');
    dbLiability = null;
  }

  // ── Drift ──
  let drift = null;
  let balanced = null;
  if (onChainUsdc !== null && dbLiability !== null) {
    drift = Number((onChainUsdc - dbLiability).toFixed(7));
    balanced = Math.abs(drift) <= DRIFT_TOLERANCE;
    if (drift < -DRIFT_TOLERANCE) {
      criticals.push(
        `Escrow SHORTFALL: on-chain USDC (${onChainUsdc}) is below liability (${dbLiability}) by ${Math.abs(drift)}`
      );
    } else if (drift > DRIFT_TOLERANCE) {
      warnings.push(
        `Escrow surplus: on-chain USDC (${onChainUsdc}) exceeds liability (${dbLiability}) by ${drift} (unreleased fees/dust?)`
      );
    }
  }

  // ── Partner float snapshot (operational context, not part of drift) ──
  let partnerFloat = null;
  try {
    const f = await db.query(
      `SELECT
         COALESCE(SUM(available_float), 0)  AS available_float,
         COALESCE(SUM(reserved_float), 0)   AS reserved_float,
         COALESCE(SUM(available_usdc), 0)   AS available_usdc,
         COALESCE(SUM(reserved_usdc), 0)    AS reserved_usdc
       FROM trader_payout_settings`
    );
    const row = f.rows[0] || {};
    partnerFloat = {
      available_float: parseFloat(row.available_float) || 0,
      reserved_float: parseFloat(row.reserved_float) || 0,
      available_usdc: parseFloat(row.available_usdc) || 0,
      reserved_usdc: parseFloat(row.reserved_usdc) || 0,
    };
  } catch (e) {
    // trader_payout_settings may not exist in older DBs — non-fatal
    warnings.push('Could not read partner float snapshot');
  }

  // ── Anomalies: in-flight tx missing a USDC amount (would understate liability) ──
  let missingUsdcCount = 0;
  try {
    const m = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM transactions
       WHERE state = ANY($1) AND (usdc_amount IS NULL OR usdc_amount <= 0)`,
      [IN_FLIGHT_STATES]
    );
    missingUsdcCount = m.rows[0]?.n || 0;
    if (missingUsdcCount > 0) {
      warnings.push(`${missingUsdcCount} in-flight transaction(s) have no usdc_amount — liability may be understated`);
    }
  } catch (e) {
    // non-fatal
  }

  const status = criticals.length > 0 ? 'CRITICAL' : warnings.length > 0 ? 'WARNING' : 'OK';

  return {
    network: config.stellar.network,
    escrow_public_key: config.stellar.escrowPublicKey
      ? `${config.stellar.escrowPublicKey.slice(0, 6)}…${config.stellar.escrowPublicKey.slice(-4)}`
      : null,
    on_chain_usdc: onChainUsdc,
    db_liability_usdc: dbLiability,
    drift_usdc: drift,
    drift_tolerance: DRIFT_TOLERANCE,
    balanced,
    in_flight_count: inFlightCount,
    by_state: byState,
    missing_usdc_count: missingUsdcCount,
    partner_float: partnerFloat,
    status,
    warnings,
    criticals,
    checked_at: new Date().toISOString(),
  };
}

export default { getEscrowReconciliation };
