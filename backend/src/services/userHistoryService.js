/**
 * B7 — Unified P2P + utility purchase history for wallet UI.
 */

import db from '../db/index.js';

function mapP2pRow(row) {
  const shortRef = row.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  let durationMinutes = null;
  if (row.completed_at && row.created_at) {
    durationMinutes = Math.max(
      1,
      Math.round((new Date(row.completed_at) - new Date(row.created_at)) / 60000)
    );
  }
  const usdcAmount = row.usdc_amount != null ? parseFloat(row.usdc_amount) : null;
  const fiatAmount = row.fiat_amount != null ? parseFloat(row.fiat_amount) : null;
  const rate = row.locked_rate != null ? parseFloat(row.locked_rate) : null;
  let resolvedUsdc = Number.isFinite(usdcAmount) && usdcAmount > 0 ? usdcAmount : null;
  if (resolvedUsdc == null && Number.isFinite(fiatAmount) && fiatAmount > 0
      && Number.isFinite(rate) && rate > 0) {
    resolvedUsdc = parseFloat((fiatAmount / rate).toFixed(7));
  }
  return {
    kind: 'p2p',
    id: row.id,
    short_id: `ROW-${shortRef}`,
    state: row.state,
    xlm_amount: row.xlm_amount != null ? parseFloat(row.xlm_amount) : null,
    usdc_amount: resolvedUsdc,
    fiat_amount: fiatAmount,
    currency: row.fiat_currency,
    rate,
    locked_rate: rate,
    network: row.network,
    order_side: row.order_side || 'SELL',
    trader_name: row.trader_name,
    trader_id: row.trader_id,
    payment_method: row.network,
    created_at: row.created_at,
    completed_at: row.completed_at,
    duration_minutes: durationMinutes,
    review_submitted: !!row.review_submitted,
    was_disputed: !!row.dispute_id,
    selection_method: row.preferred_payout_setting_id ? 'manual' : 'auto',
    payout_provider: row.payout_provider || null,
  };
}

function mapUtilityRow(row) {
  const typeLabel = row.utility_type === 'data'
    ? (row.bundle_description || 'Data bundle')
    : row.utility_type === 'bill' ? 'Bill pay'
      : 'Airtime';
  return {
    kind: 'utility',
    id: row.id,
    short_id: `UTL-${row.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    state: row.status,
    utility_type: row.utility_type,
    utility_label: typeLabel,
    bundle_description: row.bundle_description || null,
    usdc_amount: Number(row.usdc_amount),
    fiat_amount: Number(row.fiat_amount),
    currency: row.fiat_currency,
    network: row.network_code,
    recipient_phone: row.recipient_phone,
    operator_name: row.operator_name,
    payment_tx_hash: row.payment_tx_hash,
    external_ref: row.external_ref,
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

function p2pStatusCondition(status) {
  if (status === 'completed') return `t.state = 'COMPLETE'`;
  if (status === 'cancelled') return `t.state = 'FAILED'`;
  if (status === 'refunded') return `t.state = 'REFUNDED'`;
  if (status === 'disputed') {
    return `(t.dispute_id IS NOT NULL OR t.state IN ('DISPUTE_OPENED', 'DISPUTE_REFUND_PENDING', 'DISPUTE_RELEASE_PENDING'))`;
  }
  return null;
}

function utilityStatusCondition(status) {
  if (status === 'completed') return `up.status = 'COMPLETED'`;
  if (status === 'cancelled') return `up.status IN ('FAILED', 'EXPIRED')`;
  if (status === 'refunded' || status === 'disputed') return `1=0`;
  return `up.status NOT IN ('QUOTED')`;
}

function rangeCondition(alias, range) {
  if (range === 'week') return `${alias}.created_at >= NOW() - INTERVAL '7 days'`;
  if (range === 'month') return `${alias}.created_at >= NOW() - INTERVAL '30 days'`;
  return null;
}

export async function getUnifiedTransactionHistory({
  userId,
  page = 1,
  limit = 20,
  status = 'all',
  range = 'all',
  category = 'all',
}) {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;
  const includeP2p = category === 'all' || category === 'p2p';
  const includeUtilities = category === 'all' || category === 'utilities';

  const rows = [];

  if (includeP2p) {
    const params = [userId];
    const conditions = ['t.user_id = $1'];
    const statusCond = p2pStatusCondition(status);
    if (statusCond) conditions.push(statusCond);
    const rangeCond = rangeCondition('t', range);
    if (rangeCond) conditions.push(rangeCond);

    const result = await db.query(
      `SELECT
         t.id, t.state, t.xlm_amount, t.usdc_amount, t.fiat_amount, t.fiat_currency,
         t.locked_rate, t.network, t.order_side, t.created_at, t.completed_at,
         t.dispute_id, t.preferred_payout_setting_id, t.trader_id, t.payout_provider,
         tr.name AS trader_name,
         EXISTS (
           SELECT 1 FROM reviews r
           WHERE r.transaction_id = t.id AND r.reviewer_id = t.user_id
         ) AS review_submitted
       FROM transactions t
       LEFT JOIN traders tr ON tr.id = t.trader_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.created_at DESC`,
      params
    );
    rows.push(...result.rows.map(mapP2pRow));
  }

  if (includeUtilities) {
    const params = [userId];
    const conditions = ['up.user_id = $1'];
    conditions.push(utilityStatusCondition(status));
    const rangeCond = rangeCondition('up', range);
    if (rangeCond) conditions.push(rangeCond);

    const result = await db.query(
      `SELECT
         up.id, up.utility_type, up.status, up.country_code, up.network_code,
         up.operator_name, up.recipient_phone, up.fiat_amount, up.fiat_currency,
         up.usdc_amount, up.payment_tx_hash, up.external_ref, up.bundle_description,
         up.created_at, up.completed_at
       FROM utility_purchases up
       WHERE ${conditions.join(' AND ')}
       ORDER BY up.created_at DESC`,
      params
    );
    rows.push(...result.rows.map(mapUtilityRow));
  }

  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const total = rows.length;
  const pageRows = rows.slice(offset, offset + safeLimit);

  return {
    transactions: pageRows,
    total,
    page: safePage,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getWalletHistoryStats(userId) {
  const p2pRes = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE state = 'COMPLETE')::int AS completed
     FROM transactions WHERE user_id = $1`,
    [userId]
  );
  const utilRes = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed
     FROM utility_purchases
     WHERE user_id = $1 AND status NOT IN ('QUOTED')`,
    [userId]
  );
  const p2p = p2pRes.rows[0] || {};
  const util = utilRes.rows[0] || {};
  return {
    total: (p2p.total || 0) + (util.total || 0),
    completed: (p2p.completed || 0) + (util.completed || 0),
    p2p_total: p2p.total || 0,
    utility_total: util.total || 0,
  };
}

export default {
  getUnifiedTransactionHistory,
  getWalletHistoryStats,
};
