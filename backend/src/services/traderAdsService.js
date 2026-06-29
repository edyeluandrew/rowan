import db from '../db/index.js';
import traderStatsService from './traderStatsService.js';
import { assertTraderCanReceiveUsdc, getTraderUsdcTrustlineStatus } from './traderStellarService.js';

const ACTIVE_ORDER_STATES = ['TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING'];

/**
 * List active trader ads (payout settings) for the wallet marketplace.
 */
async function listAds({
  userId = null,
  currency = null,
  network = null,
  minAmount = null,
  maxAmount = null,
  paymentMethod = null,
  page = 1,
  limit = 20,
} = {}) {
  const params = [];
  const conditions = [
    `ps.is_active = TRUE`,
    `t.status = 'ACTIVE'`,
    `t.verification_status = 'VERIFIED'`,
    `t.stellar_address IS NOT NULL`,
    `(ps.available_float - ps.reserved_float) > 0`,
    `(SELECT COUNT(*) FROM transactions tx
        WHERE tx.trader_id = t.id
          AND tx.state::text = ANY('{TRADER_MATCHED,FIAT_PAYOUT_SUBMITTED,USER_CONFIRMATION_PENDING}'::text[]))
      < COALESCE(t.max_concurrent_orders, 3)`,
  ];

  if (userId) {
    params.push(userId);
    conditions.push(`t.id NOT IN (SELECT trader_id FROM blocked_traders WHERE user_id = $${params.length})`);
  }
  if (currency) {
    params.push(currency.toUpperCase());
    conditions.push(`ps.currency = $${params.length}`);
  }
  if (network) {
    params.push(network.toUpperCase());
    conditions.push(`ps.network = $${params.length}::mobile_network`);
  }
  if (paymentMethod) {
    params.push(`%${paymentMethod}%`);
    conditions.push(`ps.network::text ILIKE $${params.length}`);
  }
  if (minAmount != null && Number.isFinite(Number(minAmount))) {
    params.push(Number(minAmount));
    conditions.push(`ps.max_amount >= $${params.length}`);
  }
  if (maxAmount != null && Number.isFinite(Number(maxAmount))) {
    params.push(Number(maxAmount));
    conditions.push(`ps.min_amount <= $${params.length}`);
  }

  const offset = (Math.max(1, page) - 1) * Math.min(limit, 50);
  params.push(Math.min(limit, 50));
  params.push(offset);

  const query = `
    SELECT
      ps.id AS payout_setting_id,
      ps.trader_id,
      t.name AS trader_name,
      t.stellar_address,
      t.trust_score,
      t.last_seen_at,
      t.max_concurrent_orders,
      ps.network,
      ps.currency,
      ps.country,
      ps.min_amount,
      ps.max_amount,
      ps.available_float,
      ps.reserved_float,
      ps.rate_per_usdc,
      (ps.available_float - ps.reserved_float) AS net_float,
      (SELECT COUNT(*)::int FROM transactions tx
         WHERE tx.trader_id = t.id
           AND tx.state::text = ANY('{TRADER_MATCHED,FIAT_PAYOUT_SUBMITTED,USER_CONFIRMATION_PENDING}'::text[])) AS active_orders
    FROM trader_payout_settings ps
    JOIN traders t ON t.id = ps.trader_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.trust_score DESC, net_float DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const result = await db.query(query, params);

  const ads = (await Promise.all(
    result.rows.map(async (row) => {
      const trustStatus = await getTraderUsdcTrustlineStatus(row.stellar_address);
      if (!trustStatus.hasTrustline) return null;

      const stats = await traderStatsService.getTraderStats(row.trader_id);
      const online = traderStatsService.enrichOnlineStatus(row);
      return {
        id: row.payout_setting_id,
        payoutSettingId: row.payout_setting_id,
        traderId: row.trader_id,
        traderName: row.trader_name,
        trustScore: parseFloat(row.trust_score),
        network: row.network,
        currency: row.currency,
        country: row.country,
        minAmount: parseFloat(row.min_amount),
        maxAmount: parseFloat(row.max_amount),
        availableFloat: parseFloat(row.net_float),
        ratePerUsdc: row.rate_per_usdc != null ? parseFloat(row.rate_per_usdc) : null,
        completionRate: stats.completionRate,
        avgReleaseMinutes: stats.avgReleaseMinutes,
        avgResponseMinutes: stats.avgResponseMinutes,
        reviewCount: stats.reviewCount,
        positivePercent: stats.positivePercent,
        activeOrders: row.active_orders,
        maxConcurrentOrders: row.max_concurrent_orders,
        ...online,
      };
    })
  )).filter(Boolean);

  return { ads, page: Math.max(1, page), limit: Math.min(limit, 50) };
}

async function getAdById(payoutSettingId) {
  const result = await db.query(
    `SELECT ps.*, t.name AS trader_name, t.trust_score, t.verification_status, t.status,
            t.stellar_address, t.last_seen_at, t.max_concurrent_orders
     FROM trader_payout_settings ps
     JOIN traders t ON t.id = ps.trader_id
     WHERE ps.id = $1 AND ps.is_active = TRUE`,
    [payoutSettingId]
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.status !== 'ACTIVE' || row.verification_status !== 'VERIFIED') return null;

  const trustStatus = await getTraderUsdcTrustlineStatus(row.stellar_address);
  if (!trustStatus.hasTrustline) return null;

  const stats = await traderStatsService.getTraderStats(row.trader_id);
  const reviews = await traderStatsService.getRecentReviews(row.trader_id, 10);
  const online = traderStatsService.enrichOnlineStatus(row);

  return {
    id: row.id,
    payoutSettingId: row.id,
    traderId: row.trader_id,
    traderName: row.trader_name,
    trustScore: parseFloat(row.trust_score),
    network: row.network,
    currency: row.currency,
    country: row.country,
    minAmount: parseFloat(row.min_amount),
    maxAmount: parseFloat(row.max_amount),
    availableFloat: parseFloat(row.available_float) - parseFloat(row.reserved_float || 0),
    ratePerUsdc: row.rate_per_usdc != null ? parseFloat(row.rate_per_usdc) : null,
    stats,
    reviews,
    ...online,
  };
}

/**
 * Validate a payout setting can serve a quote (network, amount, float).
 */
async function validateAdForQuote(payoutSettingId, { network, currency, fiatAmount, userId = null }) {
  const result = await db.query(
    `SELECT ps.*, t.status, t.verification_status, t.stellar_address, t.max_concurrent_orders,
            (SELECT COUNT(*)::int FROM transactions tx
               WHERE tx.trader_id = t.id
                 AND tx.state::text = ANY('{TRADER_MATCHED,FIAT_PAYOUT_SUBMITTED,USER_CONFIRMATION_PENDING}'::text[])) AS active_orders
     FROM trader_payout_settings ps
     JOIN traders t ON t.id = ps.trader_id
     WHERE ps.id = $1 AND ps.is_active = TRUE`,
    [payoutSettingId]
  );
  const row = result.rows[0];
  if (!row) {
    const err = new Error('Trader ad not found or inactive');
    err.statusCode = 404;
    throw err;
  }
  if (row.status !== 'ACTIVE' || row.verification_status !== 'VERIFIED' || !row.stellar_address) {
    const err = new Error('Trader is not available');
    err.statusCode = 409;
    throw err;
  }
  if (userId) {
    const blocked = await db.query(
      `SELECT 1 FROM blocked_traders WHERE user_id = $1 AND trader_id = $2`,
      [userId, row.trader_id]
    );
    if (blocked.rows.length > 0) {
      const err = new Error('This trader is blocked');
      err.statusCode = 409;
      throw err;
    }
  }
  if (row.active_orders >= (row.max_concurrent_orders || 3)) {
    const err = new Error('Trader is at capacity for new orders');
    err.statusCode = 409;
    throw err;
  }
  if (row.network !== network || row.currency !== currency) {
    const err = new Error('Trader ad does not support this network or currency');
    err.statusCode = 400;
    throw err;
  }
  const fiat = parseFloat(fiatAmount);
  if (fiat < parseFloat(row.min_amount) || fiat > parseFloat(row.max_amount)) {
    const err = new Error(`Amount must be between ${row.min_amount} and ${row.max_amount} ${currency}`);
    err.statusCode = 400;
    throw err;
  }
  const netFloat = parseFloat(row.available_float) - parseFloat(row.reserved_float || 0);
  if (netFloat < fiat) {
    const err = new Error('Trader does not have enough float for this amount');
    err.statusCode = 409;
    throw err;
  }
  await assertTraderCanReceiveUsdc(row.stellar_address);
  return row;
}

export default {
  listAds,
  getAdById,
  validateAdForQuote,
  ACTIVE_ORDER_STATES,
};
