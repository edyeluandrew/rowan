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
    `ps.ad_side = 'USER_SELL'`,
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
      t.created_at AS member_since,
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
        completedOrders: stats.completedOrders,
        memberSince: row.member_since,
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

/**
 * Collapse flat marketplace ads into one row per trader with nested payment offers.
 */
function groupAdsByTrader(ads, { isBuy = false } = {}) {
  const byTrader = new Map();

  for (const ad of ads) {
    const traderId = ad.traderId;
    if (!traderId) continue;

    if (!byTrader.has(traderId)) {
      byTrader.set(traderId, {
        traderId,
        traderName: ad.traderName,
        trustScore: ad.trustScore,
        memberSince: ad.memberSince,
        completedOrders: ad.completedOrders ?? 0,
        completionRate: ad.completionRate,
        avgReleaseMinutes: ad.avgReleaseMinutes,
        avgResponseMinutes: ad.avgResponseMinutes,
        reviewCount: ad.reviewCount,
        positivePercent: ad.positivePercent,
        isOnline: ad.isOnline,
        lastSeenLabel: ad.lastSeenLabel,
        currency: ad.currency,
        offers: [],
      });
    }

    const group = byTrader.get(traderId);
    group.offers.push({
      payoutSettingId: ad.payoutSettingId || ad.id,
      network: ad.network,
      currency: ad.currency,
      minAmount: ad.minAmount,
      maxAmount: ad.maxAmount,
      availableFloat: ad.availableFloat,
      availableUsdc: ad.availableUsdc,
      ratePerUsdc: ad.ratePerUsdc,
      adSide: ad.adSide || (isBuy ? 'USER_BUY' : 'USER_SELL'),
    });
  }

  const traders = Array.from(byTrader.values()).map((group) => {
    const mins = group.offers.map((o) => o.minAmount).filter((v) => Number.isFinite(v));
    const maxs = group.offers.map((o) => o.maxAmount).filter((v) => Number.isFinite(v));
    const floats = group.offers.map((o) => o.availableFloat).filter((v) => Number.isFinite(v) && v > 0);
    const usdcs = group.offers.map((o) => o.availableUsdc).filter((v) => Number.isFinite(v) && v > 0);
    const rates = group.offers.map((o) => o.ratePerUsdc).filter((v) => Number.isFinite(v) && v > 0);

    return {
      ...group,
      minAmount: mins.length ? Math.min(...mins) : null,
      maxAmount: maxs.length ? Math.max(...maxs) : null,
      totalAvailableFloat: floats.length ? floats.reduce((a, b) => a + b, 0) : null,
      totalAvailableUsdc: usdcs.length ? usdcs.reduce((a, b) => a + b, 0) : null,
      bestRatePerUsdc: rates.length ? Math.max(...rates) : null,
      offers: group.offers.sort((a, b) => (a.network || '').localeCompare(b.network || '')),
    };
  });

  traders.sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0));
  return traders;
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

  const isBuyAd = row.ad_side === 'USER_BUY';
  const netFloat = parseFloat(row.available_float || 0) - parseFloat(row.reserved_float || 0);
  const netUsdc = parseFloat(row.available_usdc || 0) - parseFloat(row.reserved_usdc || 0);

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
    adSide: row.ad_side || 'USER_SELL',
    availableFloat: isBuyAd ? undefined : netFloat,
    availableUsdc: isBuyAd ? netUsdc : undefined,
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

/**
 * List buy-side ads (traders selling USDC to users).
 */
async function listBuyAds({
  userId = null,
  currency = null,
  network = null,
  minAmount = null,
  maxAmount = null,
  page = 1,
  limit = 20,
} = {}) {
  const params = [];
  const conditions = [
    `ps.is_active = TRUE`,
    `ps.ad_side = 'USER_BUY'`,
    `t.status = 'ACTIVE'`,
    `t.verification_status = 'VERIFIED'`,
    `t.stellar_address IS NOT NULL`,
    `(ps.available_usdc - ps.reserved_usdc) > 0`,
    `ps.rate_per_usdc IS NOT NULL`,
    `ps.rate_per_usdc > 0`,
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
      t.trust_score,
      t.created_at AS member_since,
      t.last_seen_at,
      ps.network,
      ps.currency,
      ps.country,
      ps.min_amount,
      ps.max_amount,
      ps.available_usdc,
      ps.reserved_usdc,
      (ps.available_usdc - ps.reserved_usdc) AS net_usdc_float,
      ps.rate_per_usdc,
      t.stellar_address,
      (SELECT COUNT(*)::int FROM transactions tx
         WHERE tx.trader_id = t.id
           AND tx.state::text = ANY('{TRADER_MATCHED,FIAT_PAYOUT_SUBMITTED,USER_CONFIRMATION_PENDING}'::text[])) AS active_orders
    FROM trader_payout_settings ps
    JOIN traders t ON t.id = ps.trader_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.trust_score DESC, net_usdc_float DESC
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
        availableUsdc: parseFloat(row.net_usdc_float),
        ratePerUsdc: row.rate_per_usdc != null ? parseFloat(row.rate_per_usdc) : null,
        adSide: 'USER_BUY',
        completionRate: stats.completionRate,
        completedOrders: stats.completedOrders,
        memberSince: row.member_since,
        avgReleaseMinutes: stats.avgReleaseMinutes,
        avgResponseMinutes: stats.avgResponseMinutes,
        reviewCount: stats.reviewCount,
        positivePercent: stats.positivePercent,
        activeOrders: row.active_orders,
        ...online,
      };
    })
  )).filter(Boolean);

  return { ads, page: Math.max(1, page), limit: Math.min(limit, 50) };
}

async function validateBuyAdForQuote(payoutSettingId, { network, currency, fiatAmount, usdcAmount, userId = null }) {
  const result = await db.query(
    `SELECT ps.*, t.status, t.verification_status, t.stellar_address, t.max_concurrent_orders,
            (SELECT COUNT(*)::int FROM transactions tx
               WHERE tx.trader_id = t.id
                 AND tx.state::text = ANY('{TRADER_MATCHED,FIAT_PAYOUT_SUBMITTED,USER_CONFIRMATION_PENDING}'::text[])) AS active_orders
     FROM trader_payout_settings ps
     JOIN traders t ON t.id = ps.trader_id
     WHERE ps.id = $1 AND ps.is_active = TRUE AND ps.ad_side = 'USER_BUY'`,
    [payoutSettingId]
  );
  const row = result.rows[0];
  if (!row) {
    const err = new Error('Buy ad not found or inactive');
    err.statusCode = 404;
    throw err;
  }
  if (row.status !== 'ACTIVE' || row.verification_status !== 'VERIFIED') {
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
  if (row.network !== network || row.currency !== currency) {
    const err = new Error('Ad does not support this network or currency');
    err.statusCode = 400;
    throw err;
  }
  if (!row.rate_per_usdc || parseFloat(row.rate_per_usdc) <= 0) {
    const err = new Error('Trader has not set a USDC price for this ad');
    err.statusCode = 409;
    err.code = 'TRADER_RATE_REQUIRED';
    throw err;
  }
  const fiat = parseFloat(fiatAmount);
  if (fiat < parseFloat(row.min_amount) || fiat > parseFloat(row.max_amount)) {
    const err = new Error(`Amount must be between ${row.min_amount} and ${row.max_amount} ${currency}`);
    err.statusCode = 400;
    throw err;
  }
  const netUsdc = parseFloat(row.available_usdc) - parseFloat(row.reserved_usdc || 0);
  if (netUsdc < parseFloat(usdcAmount)) {
    const err = new Error('Trader does not have enough USDC for this amount');
    err.statusCode = 409;
    throw err;
  }
  await assertTraderCanReceiveUsdc(row.stellar_address);
  return row;
}

export default {
  listAds,
  listBuyAds,
  groupAdsByTrader,
  getAdById,
  validateAdForQuote,
  validateBuyAdForQuote,
  ACTIVE_ORDER_STATES,
};
