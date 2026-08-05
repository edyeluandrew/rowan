import db from '../db/index.js';
import config from '../config/index.js';
import kycTierService from './kyc/kycTierService.js';
import logger from '../utils/logger.js';

/**
 * FraudMonitor — L2 internal module.
 * Enforces per-user daily limits and per-transaction caps (scaling with KYC level),
 * flags admin alerts for suspicious patterns, and triggers auto-refunds.
 * 
 * [PHASE 4] KYC limits and fraud thresholds now sourced from config.
 */

/**
 * Check if a user's requested cash-out violates any fraud rules.
 * Returns { allowed: boolean, reason?: string }
 */
async function checkTransaction(userId, fiatAmount, fiatCurrency, options = {}) {
  const tierCheck = await kycTierService.checkTransactionLimits(
    userId,
    fiatAmount,
    fiatCurrency,
    options
  );
  if (!tierCheck.allowed) {
    if (tierCheck.code === 'KYC_PER_TX_LIMIT') {
      await logAlert(userId, 'PER_TX_LIMIT', tierCheck.reason);
    } else if (tierCheck.code === 'KYC_DAILY_LIMIT') {
      await logAlert(userId, 'DAILY_LIMIT', tierCheck.reason);
    }
    return tierCheck;
  }

  const limits = tierCheck.limits;
  const amountUgx = tierCheck.amountUgx;

  // Concurrent quote check
  // [PHASE 4] Use config-driven threshold instead of hardcoded 3
  const concurrentResult = await db.query(
    `SELECT COUNT(*) as open_quotes
     FROM quotes
     WHERE user_id = $1 AND is_used = FALSE AND expires_at > NOW()`,
    [userId]
  );
  const openQuotes = parseInt(concurrentResult.rows[0].open_quotes);
  if (openQuotes >= config.fraud.maxConcurrentQuotes) {
    await logAlert(userId, 'CONCURRENT_QUOTES', `User has ${openQuotes} open quotes simultaneously`);
    return { allowed: false, reason: 'Too many open quotes. Please wait for existing quotes to expire.' };
  }

  // Flag unusually large transactions (above threshold % of limit)
  if (amountUgx > limits.perTxUgx * config.fraud.largeTransactionAlertThreshold) {
    await logAlert(userId, 'LARGE_TX', `Transaction of ${fiatAmount} ${fiatCurrency} (${Math.round(amountUgx)} UGX) is above ${Math.round(config.fraud.largeTransactionAlertThreshold * 100)}% of per-tx limit`);
  }

  return { allowed: true, limits };
}

/**
 * Check if a trader has repeated failed confirmations — potential fraud signal.
 * [PHASE 4] Uses config-driven thresholds instead of hardcoded values.
 */
async function checkTraderHealth(traderId) {
  // Failed confirmations in last 24 hours
  const failedResult = await db.query(
    `SELECT COUNT(*) as failed_count
     FROM transactions
     WHERE trader_id = $1
       AND state = 'FAILED'
       AND failed_at >= NOW() - INTERVAL '24 hours'`,
    [traderId]
  );
  const failedCount = parseInt(failedResult.rows[0].failed_count);

  // [PHASE 4] Use config-driven threshold instead of hardcoded 5
  if (failedCount >= config.fraud.traderFailureThreshold) {
    await logAlert(null, 'TRADER_REPEATED_FAILURES', `Trader ${traderId} has ${failedCount} failures in 24h`, traderId);
    // ── P2 FIX: Use status enum instead of is_active boolean ──
    await db.query(
      `UPDATE traders SET status = 'PAUSED', is_active = FALSE WHERE id = $1`,
      [traderId]
    );
    return { healthy: false, reason: 'Auto-paused due to repeated failures' };
  }

  // Open disputes
  const disputeResult = await db.query(
    `SELECT COUNT(*) as dispute_count
     FROM disputes
     WHERE trader_id = $1 AND status IN ('OPEN', 'RESOLVED_FOR_USER')`,
    [traderId]
  );
  // [PHASE 4] Use config-driven threshold instead of hardcoded 3
  if (parseInt(disputeResult.rows[0].dispute_count) >= config.fraud.traderDisputeThreshold) {
    // ── P2 FIX: Use status enum instead of is_suspended boolean ──
    await db.query(
      `UPDATE traders SET status = 'SUSPENDED', is_suspended = TRUE WHERE id = $1`,
      [traderId]
    );
    return { healthy: false, reason: 'Auto-suspended: 3+ disputes' };
  }

  return { healthy: true };
}

/**
 * Log a fraud alert for admin review.
 * [L-4 FIX] Persists to fraud_alerts table for admin dashboard visibility.
 */
async function logAlert(userId, alertType, details, traderId = null) {
  // Derive severity from alert type
  const severityMap = {
    PER_TX_LIMIT: 'HIGH',
    DAILY_LIMIT: 'HIGH',
    CONCURRENT_QUOTES: 'MEDIUM',
    LARGE_TX: 'LOW',
    TRADER_REPEATED_FAILURES: 'HIGH',
    SANCTIONS_HIT: 'HIGH',
  };
  const severity = severityMap[alertType] || 'MEDIUM';

  logger.warn(`[FraudMonitor] ALERT — type: ${alertType}, severity: ${severity}, user: ${userId || 'N/A'}, details: ${details}`);

  try {
    await db.query(
      `INSERT INTO fraud_alerts (user_id, trader_id, alert_type, details, severity)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, traderId, alertType, details, severity]
    );
  } catch (err) {
    logger.error('[FraudMonitor] Failed to persist alert:', { error: err.message });
  }
}

export default {
  checkTransaction,
  checkTraderHealth,
  logAlert,
};
