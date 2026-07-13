import db from '../db/index.js';
import config from '../config/index.js';
import quoteEngine from './quoteEngine.js';
import buyQuoteEngine from './buyQuoteEngine.js';
import traderStatsService from './traderStatsService.js';
import { getTraderUsdcTrustlineStatus } from './traderStellarService.js';
import { fiatToUgx } from '../utils/financial.js';

const { feePercent, spreadPercent, quoteSlippagePercent } = config.platform;

/**
 * Composite Express score (higher = better for the user).
 * Weights: trust, completion, volume, speed, load, online, price edge.
 */
function computeExpressScore({
  trustScore = 50,
  completionRate = null,
  completedOrders = 0,
  avgReleaseMinutes = null,
  activeLoad = 0,
  isOnline = false,
  priceEdge = 0.5,
}) {
  const trust = Math.max(0, Math.min(100, Number(trustScore) || 0)) / 100;
  const completion = completionRate != null
    ? Math.max(0, Math.min(100, Number(completionRate))) / 100
    : 0.7;
  const volume = Math.min(1, Math.log10(Math.max(1, Number(completedOrders) || 1) + 1) / 3);
  const release = avgReleaseMinutes == null
    ? 0.6
    : Math.max(0, 1 - Math.min(60, Number(avgReleaseMinutes)) / 60);
  const load = Math.max(0, 1 - Math.min(5, Number(activeLoad) || 0) / 5);
  const online = isOnline ? 1 : 0.35;
  const price = Math.max(0, Math.min(1, Number(priceEdge)));

  return (
    trust * 0.25 +
    completion * 0.2 +
    volume * 0.1 +
    release * 0.15 +
    load * 0.1 +
    online * 0.05 +
    price * 0.15
  );
}

async function enrichCandidate(row, { priceEdge = 0.5 } = {}) {
  const stats = await traderStatsService.getTraderStats(row.trader_id);
  const online = traderStatsService.enrichOnlineStatus(row);
  const score = computeExpressScore({
    trustScore: row.trust_score,
    completionRate: stats.completionRate,
    completedOrders: stats.completedOrders,
    avgReleaseMinutes: stats.avgReleaseMinutes,
    activeLoad: row.active_load ?? stats.activeOrders,
    isOnline: online.isOnline,
    priceEdge,
  });

  return {
    traderId: row.trader_id,
    traderName: row.trader_name,
    payoutSettingId: row.payout_setting_id,
    trustScore: parseFloat(row.trust_score) || 0,
    completionRate: stats.completionRate,
    completedOrders: stats.completedOrders,
    avgReleaseMinutes: stats.avgReleaseMinutes,
    avgResponseMinutes: stats.avgResponseMinutes,
    positivePercent: stats.positivePercent,
    reviewCount: stats.reviewCount,
    activeOrders: stats.activeOrders,
    isOnline: online.isOnline,
    lastSeenLabel: online.lastSeenLabel,
    network: row.network,
    currency: row.currency,
    minAmount: parseFloat(row.min_amount),
    maxAmount: parseFloat(row.max_amount),
    ratePerUsdc: row.rate_per_usdc != null ? parseFloat(row.rate_per_usdc) : null,
    availableUsdc: row.net_usdc != null ? parseFloat(row.net_usdc) : undefined,
    availableFloat: row.net_float != null ? parseFloat(row.net_float) : undefined,
    matchScore: Math.round(score * 1000) / 10,
  };
}

/**
 * Estimate net fiat from USDC the user will sell (deposit), using platform FX + fee/spread.
 */
async function estimateFiatFromUsdcSell(usdcAmount, network) {
  const fiatCurrency = quoteEngine.networkToFiat(network);
  const fx = await (await import('./fxService.js')).default.assertFiatFxAvailableForQuote(fiatCurrency);
  const rate = fx.rate;
  const feeMul = 1 - (feePercent / 100);
  const spreadMul = 1 - (spreadPercent / 100);
  const slippageMul = 1 + ((quoteSlippagePercent || 0) / 100);
  const usdcForTrader = Number(usdcAmount) / slippageMul;
  const grossFiat = usdcForTrader * rate * spreadMul;
  const platformFee = grossFiat * (1 - feeMul);
  const netFiat = grossFiat * feeMul;

  return {
    fiatCurrency,
    usdcToFiat: rate,
    estimatedFiat: fiatCurrency === 'KES'
      ? parseFloat(netFiat.toFixed(2))
      : Math.round(netFiat),
    platformFeeFiat: fiatCurrency === 'KES'
      ? parseFloat(platformFee.toFixed(2))
      : Math.round(platformFee),
    userRate: rate * spreadMul * feeMul,
    rateSource: 'LIVE',
  };
}

/**
 * Find best USER_SELL ad for Express (user sells USDC → receives fiat).
 */
async function findBestSellAdForExpress({
  network,
  currency,
  fiatAmount,
  userId = null,
} = {}) {
  const fiat = Number(fiatAmount);
  if (!Number.isFinite(fiat) || fiat <= 0) {
    const err = new Error('Invalid fiat amount');
    err.statusCode = 400;
    throw err;
  }

  const fiatAmountUgx = fiatToUgx(fiat, currency);
  const params = [network.toUpperCase(), currency.toUpperCase(), fiat, fiatAmountUgx];
  const conditions = [
    `ps.is_active = TRUE`,
    `ps.ad_side = 'USER_SELL'`,
    `t.status = 'ACTIVE'`,
    `t.verification_status = 'VERIFIED'`,
    `t.stellar_address IS NOT NULL`,
    `ps.network = $1::mobile_network`,
    `ps.currency = $2`,
    `$3 BETWEEN ps.min_amount AND ps.max_amount`,
    `(ps.available_float - ps.reserved_float) >= $3`,
    `(t.daily_volume + $4) <= t.daily_limit_ugx`,
    `(SELECT COUNT(*) FROM transactions tx
        WHERE tx.trader_id = t.id
          AND tx.state::text = ANY('{TRADER_MATCHED,FIAT_PAYOUT_SUBMITTED,USER_CONFIRMATION_PENDING}'::text[]))
      < COALESCE(t.max_concurrent_orders, 3)`,
  ];

  if (userId) {
    params.push(userId);
    conditions.push(`t.id NOT IN (SELECT trader_id FROM blocked_traders WHERE user_id = $${params.length})`);
  }

  const result = await db.query(
    `SELECT ps.id AS payout_setting_id, ps.trader_id, t.name AS trader_name,
            t.trust_score, t.stellar_address, t.last_seen_at,
            ps.network, ps.currency, ps.min_amount, ps.max_amount,
            (ps.available_float - ps.reserved_float) AS net_float,
            (SELECT COUNT(*)::int FROM transactions tx
               WHERE tx.trader_id = t.id
                 AND tx.state::text = ANY('{TRADER_MATCHED,FIAT_PAYOUT_SUBMITTED,USER_CONFIRMATION_PENDING}'::text[])) AS active_load
     FROM trader_payout_settings ps
     JOIN traders t ON t.id = ps.trader_id
     WHERE ${conditions.join(' AND ')}
     LIMIT 40`,
    params
  );

  if (result.rows.length === 0) {
    const err = new Error('No traders available to buy your USDC for this amount right now.');
    err.statusCode = 503;
    err.code = 'NO_SELL_TRADERS';
    throw err;
  }

  const ranked = [];
  for (const row of result.rows) {
    const trustStatus = await getTraderUsdcTrustlineStatus(row.stellar_address);
    if (!trustStatus.hasTrustline) continue;
    const candidate = await enrichCandidate(row, { priceEdge: 0.55 });
    ranked.push(candidate);
  }

  if (ranked.length === 0) {
    const err = new Error('No traders available to buy your USDC for this amount right now.');
    err.statusCode = 503;
    err.code = 'NO_SELL_TRADERS';
    throw err;
  }

  ranked.sort((a, b) => b.matchScore - a.matchScore);
  return ranked[0];
}

/**
 * Find best USER_BUY ad for Express (user buys USDC with fiat).
 */
async function findBestBuyAdRanked({
  network,
  currency,
  fiatAmount,
  userId = null,
} = {}) {
  const fiat = Number(fiatAmount);
  if (!Number.isFinite(fiat) || fiat <= 0) {
    const err = new Error('Invalid fiat amount');
    err.statusCode = 400;
    throw err;
  }

  const feeMul = 1 - (feePercent / 100);
  const spreadMul = 1 - (spreadPercent / 100);
  const params = [network.toUpperCase(), currency.toUpperCase(), fiat];
  const conditions = [
    `ps.is_active = TRUE`,
    `ps.ad_side = 'USER_BUY'`,
    `t.status = 'ACTIVE'`,
    `t.verification_status = 'VERIFIED'`,
    `t.stellar_address IS NOT NULL`,
    `ps.network = $1::mobile_network`,
    `ps.currency = $2`,
    `$3 BETWEEN ps.min_amount AND ps.max_amount`,
    `ps.rate_per_usdc IS NOT NULL`,
    `ps.rate_per_usdc > 0`,
    `(ps.available_usdc - ps.reserved_usdc) > 0`,
    `(SELECT COUNT(*) FROM transactions tx
        WHERE tx.trader_id = t.id
          AND tx.state::text = ANY('{TRADER_MATCHED,FIAT_PAYOUT_SUBMITTED,USER_CONFIRMATION_PENDING}'::text[]))
      < COALESCE(t.max_concurrent_orders, 3)`,
  ];

  if (userId) {
    params.push(userId);
    conditions.push(`t.id NOT IN (SELECT trader_id FROM blocked_traders WHERE user_id = $${params.length})`);
  }

  const result = await db.query(
    `SELECT ps.id AS payout_setting_id, ps.trader_id, t.name AS trader_name,
            t.trust_score, t.stellar_address, t.last_seen_at,
            ps.network, ps.currency, ps.min_amount, ps.max_amount, ps.rate_per_usdc,
            (ps.available_usdc - ps.reserved_usdc) AS net_usdc,
            (SELECT COUNT(*)::int FROM transactions tx
               WHERE tx.trader_id = t.id
                 AND tx.state::text = ANY('{TRADER_MATCHED,FIAT_PAYOUT_SUBMITTED,USER_CONFIRMATION_PENDING}'::text[])) AS active_load
     FROM trader_payout_settings ps
     JOIN traders t ON t.id = ps.trader_id
     WHERE ${conditions.join(' AND ')}
     LIMIT 40`,
    params
  );

  if (result.rows.length === 0) {
    const err = new Error('No traders available to sell USDC for this amount right now.');
    err.statusCode = 503;
    err.code = 'NO_BUY_TRADERS';
    throw err;
  }

  const rates = result.rows
    .map((r) => parseFloat(r.rate_per_usdc))
    .filter((r) => Number.isFinite(r) && r > 0);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const rateSpan = Math.max(0.0001, maxRate - minRate);

  const ranked = [];
  for (const row of result.rows) {
    const rate = parseFloat(row.rate_per_usdc);
    const usdcNeeded = (fiat * feeMul * spreadMul) / rate;
    if (parseFloat(row.net_usdc) < usdcNeeded) continue;

    const trustStatus = await getTraderUsdcTrustlineStatus(row.stellar_address);
    if (!trustStatus.hasTrustline) continue;

    const priceEdge = 1 - ((rate - minRate) / rateSpan);
    const candidate = await enrichCandidate(row, { priceEdge });
    ranked.push(candidate);
  }

  if (ranked.length === 0) {
    const err = new Error('No traders available to sell USDC for this amount right now.');
    err.statusCode = 503;
    err.code = 'NO_BUY_TRADERS';
    throw err;
  }

  ranked.sort((a, b) => b.matchScore - a.matchScore);
  return ranked[0];
}

/**
 * Non-committing Express preview for the match sheet.
 */
async function previewExpress({
  side,
  network,
  fiatAmount = null,
  usdcAmount = null,
  userId = null,
}) {
  const fiatCurrency = quoteEngine.networkToFiat(network);
  const isBuy = side === 'buy';

  if (isBuy) {
    const fiat = Number(fiatAmount);
    if (!Number.isFinite(fiat) || fiat <= 0) {
      const err = new Error('Enter the fiat amount you want to spend');
      err.statusCode = 400;
      err.code = 'FIAT_AMOUNT_REQUIRED';
      throw err;
    }

    const trader = await findBestBuyAdRanked({
      network,
      currency: fiatCurrency,
      fiatAmount: fiat,
      userId,
    });

    const computed = await buyQuoteEngine.computeBuyQuoteFromFiat(fiat, network, {
      ratePerUsdc: trader.ratePerUsdc,
    });

    return {
      side: 'buy',
      express: true,
      available: true,
      network,
      fiatCurrency,
      fiatAmount: computed.fiatAmountNum,
      estimatedUsdc: computed.usdcAmount,
      usdcAmount: computed.usdcAmount,
      userRate: computed.userRateAfterSpread,
      platformFeeFiat: computed.platformFeeNum,
      rateSource: 'TRADER_AD',
      trader,
      limits: {
        minFiat: trader.minAmount,
        maxFiat: trader.maxAmount,
      },
    };
  }

  const usdc = Number(usdcAmount);
  if (!Number.isFinite(usdc) || usdc <= 0) {
    const err = new Error('Enter the USDC amount you want to sell');
    err.statusCode = 400;
    err.code = 'USDC_AMOUNT_REQUIRED';
    throw err;
  }

  const sellEstimate = await estimateFiatFromUsdcSell(usdc, network);
  const trader = await findBestSellAdForExpress({
    network,
    currency: fiatCurrency,
    fiatAmount: sellEstimate.estimatedFiat,
    userId,
  });

  return {
    side: 'sell',
    express: true,
    available: true,
    network,
    fiatCurrency,
    usdcAmount: usdc,
    fiatAmount: sellEstimate.estimatedFiat,
    estimatedFiat: sellEstimate.estimatedFiat,
    userRate: sellEstimate.userRate,
    platformFeeFiat: sellEstimate.platformFeeFiat,
    rateSource: 'LIVE',
    trader,
    limits: {
      minFiat: trader.minAmount,
      maxFiat: trader.maxAmount,
    },
  };
}

export default {
  computeExpressScore,
  previewExpress,
  findBestSellAdForExpress,
  findBestBuyAdRanked,
  estimateFiatFromUsdcSell,
};
