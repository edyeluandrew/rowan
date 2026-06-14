import { server as horizon, USDC_ASSET } from '../config/stellar.js';
import config from '../config/index.js';
import db from '../db/index.js';
import quoteEngine from './quoteEngine.js';
import logger from '../utils/logger.js';

/**
 * [PHASE 2C] Liquidity + escrow + pipeline health for operations.
 *
 * Practical, focused health snapshot — NOT a full monitoring system. Every check
 * is wrapped so one failure never throws the whole report; failures are surfaced
 * as warnings/criticals and folded into an overall warningLevel.
 */

const USDC_LOW_WARN = parseFloat(process.env.HEALTH_ESCROW_USDC_WARN) || 5;     // warn below this escrow USDC
const XLM_CRIT = parseFloat(process.env.HEALTH_ESCROW_XLM_CRIT) || 2;          // critical below this escrow XLM (fees/reserve)
const XLM_WARN = parseFloat(process.env.HEALTH_ESCROW_XLM_WARN) || 5;
const STUCK_MIN = parseInt(process.env.HEALTH_STUCK_MINUTES, 10) || 30;        // pending older than this = stuck

function balOf(account, asset) {
  if (!account?.balances) return null;
  if (asset === 'XLM') {
    const b = account.balances.find((x) => x.asset_type === 'native');
    return b ? Number(b.balance) : 0;
  }
  const b = account.balances.find((x) => x.asset_code === USDC_ASSET.code && x.asset_issuer === USDC_ASSET.issuer);
  return b ? Number(b.balance) : null; // null = no trustline
}

async function loadAccountSafe(pub) {
  if (!pub) return { ok: false, reason: 'not_configured' };
  try {
    const acct = await horizon.loadAccount(pub);
    return { ok: true, acct };
  } catch (e) {
    const notFound = e?.response?.status === 404 || /not found/i.test(e.message || '');
    return { ok: false, reason: notFound ? 'not_found' : 'load_failed', error: e.message };
  }
}

export async function getLiquidityHealth() {
  const warnings = [];
  const criticals = [];

  // ── Horizon reachability + escrow account ──
  const hStart = Date.now();
  const escrowRes = await loadAccountSafe(config.stellar.escrowPublicKey);
  const horizonLatency = Date.now() - hStart;
  const horizonReachable = escrowRes.ok || escrowRes.reason === 'not_found'; // got a response either way
  if (!horizonReachable) criticals.push('Horizon unreachable (escrow account load failed)');

  const escrow = {
    public_key: config.stellar.escrowPublicKey ? `${config.stellar.escrowPublicKey.slice(0, 6)}…` : null,
    exists: escrowRes.ok,
    xlm_balance: escrowRes.ok ? balOf(escrowRes.acct, 'XLM') : null,
    usdc_balance: escrowRes.ok ? balOf(escrowRes.acct, 'USDC') : null,
    usdc_trustline: escrowRes.ok ? balOf(escrowRes.acct, 'USDC') !== null : false,
  };
  if (!escrow.exists) criticals.push('Escrow account does not exist on Stellar');
  if (escrow.exists && !escrow.usdc_trustline) criticals.push('Escrow account missing USDC trustline');
  if (escrow.exists && escrow.xlm_balance != null && escrow.xlm_balance < XLM_CRIT) criticals.push(`Escrow XLM critically low (${escrow.xlm_balance})`);
  else if (escrow.exists && escrow.xlm_balance != null && escrow.xlm_balance < XLM_WARN) warnings.push(`Escrow XLM low (${escrow.xlm_balance})`);
  if (escrow.exists && escrow.usdc_balance != null && escrow.usdc_balance < USDC_LOW_WARN) warnings.push(`Escrow USDC low (${escrow.usdc_balance})`);

  // ── Market maker ──
  const mmConfigured = !!config.stellar.marketMakerPublicKey;
  let marketMaker = { configured: mmConfigured, exists: false, usdc_trustline: false, xlm_balance: null };
  if (mmConfigured) {
    const mmRes = await loadAccountSafe(config.stellar.marketMakerPublicKey);
    marketMaker.exists = mmRes.ok;
    marketMaker.xlm_balance = mmRes.ok ? balOf(mmRes.acct, 'XLM') : null;
    marketMaker.usdc_trustline = mmRes.ok ? balOf(mmRes.acct, 'USDC') !== null : false;
    if (!mmRes.ok) warnings.push('Market maker account not found/loadable');
    else if (!marketMaker.usdc_trustline) warnings.push('Market maker missing USDC trustline');
  } else {
    warnings.push('Market maker not configured — path discovery may be degraded');
  }

  // ── Path discovery (XLM → USDC) for a small test target ──
  let pathDiscovery = { available: false, test_usdc_target: 1, xlm_needed: null };
  try {
    const p = await quoteEngine.getStrictReceivePath(1);
    if (p) { pathDiscovery.available = true; pathDiscovery.xlm_needed = p.xlmNeeded; }
  } catch (e) {
    logger.warn('[Health] path discovery check failed:', e.message);
  }
  const quoteSource = pathDiscovery.available ? 'LIVE' : 'FALLBACK';
  if (!pathDiscovery.available) {
    if (config.stellar.isMainnet && !config.platform.allowFallbackQuotes) criticals.push('Path discovery unavailable and fallback quotes disabled — cash-out quotes will fail');
    else warnings.push('Path discovery unavailable — quotes will use FALLBACK rates');
  }

  // ── Pipeline / stuck-transaction counts ──
  const pending = {
    dispute_refund_pending: 0, dispute_release_pending: 0, release_blocked: 0,
    refund_errors: 0, stuck_escrow_locked: 0, stuck_refund_pending: 0,
    stuck_release_pending: 0, recent_failed: 0,
  };
  try {
    const r = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE state='DISPUTE_REFUND_PENDING')                                            AS dispute_refund_pending,
        COUNT(*) FILTER (WHERE state='DISPUTE_RELEASE_PENDING')                                           AS dispute_release_pending,
        COUNT(*) FILTER (WHERE state='RELEASE_BLOCKED')                                                   AS release_blocked,
        COUNT(*) FILTER (WHERE refund_error IS NOT NULL)                                                  AS refund_errors,
        COUNT(*) FILTER (WHERE state='ESCROW_LOCKED' AND trader_id IS NULL AND escrow_locked_at < NOW() - INTERVAL '1 minute' * $1) AS stuck_escrow_locked,
        COUNT(*) FILTER (WHERE state='DISPUTE_REFUND_PENDING' AND dispute_resolved_at < NOW() - INTERVAL '1 minute' * $1)  AS stuck_refund_pending,
        COUNT(*) FILTER (WHERE state='DISPUTE_RELEASE_PENDING' AND dispute_resolved_at < NOW() - INTERVAL '1 minute' * $1) AS stuck_release_pending,
        COUNT(*) FILTER (WHERE state='FAILED' AND created_at > NOW() - INTERVAL '24 hours')               AS recent_failed
       FROM transactions`,
      [STUCK_MIN]
    );
    const row = r.rows[0];
    for (const k of Object.keys(pending)) pending[k] = parseInt(row[k], 10) || 0;
  } catch (e) {
    logger.error('[Health] pipeline counts query failed:', e.message);
    warnings.push('Could not read transaction pipeline counts');
  }

  if (pending.release_blocked > 0) criticals.push(`${pending.release_blocked} transaction(s) in RELEASE_BLOCKED`);
  if (pending.stuck_refund_pending > 0) warnings.push(`${pending.stuck_refund_pending} refund(s) stuck in DISPUTE_REFUND_PENDING > ${STUCK_MIN}m`);
  if (pending.stuck_release_pending > 0) warnings.push(`${pending.stuck_release_pending} release(s) stuck in DISPUTE_RELEASE_PENDING > ${STUCK_MIN}m`);
  if (pending.stuck_escrow_locked > 0) warnings.push(`${pending.stuck_escrow_locked} unmatched ESCROW_LOCKED tx > ${STUCK_MIN}m`);
  if (pending.refund_errors > 0) warnings.push(`${pending.refund_errors} transaction(s) have a refund_error`);

  const warningLevel = criticals.length > 0 ? 'CRITICAL' : warnings.length > 0 ? 'WARNING' : 'OK';

  return {
    network: config.stellar.network,
    horizon: { reachable: horizonReachable, latency_ms: horizonLatency, url: config.stellar.horizonUrl },
    escrow,
    marketMaker,
    pathDiscovery,
    quoteSource,
    fallbackQuotesAllowed: config.platform.allowFallbackQuotes,
    pending,
    warningLevel,
    warnings,
    criticals,
    checkedAt: new Date().toISOString(),
  };
}

export default { getLiquidityHealth };
