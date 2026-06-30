import { Router } from 'express';
import { authUser } from '../middleware/auth.js';
import db from '../db/index.js';
import traderAdsService from '../services/traderAdsService.js';
import traderStatsService from '../services/traderStatsService.js';
import reviewService from '../services/reviewService.js';

const router = Router();

/**
 * GET /api/v1/traders/ads
 * Browse active trader ads (marketplace).
 * Query: currency, network, minAmount, maxAmount, paymentMethod, page, limit
 */
router.get('/ads', authUser, async (req, res, next) => {
  try {
    const { currency, network, minAmount, maxAmount, paymentMethod, page, limit, side } = req.query;
    const listFn = side === 'buy' ? traderAdsService.listBuyAds : traderAdsService.listAds;
    const result = await listFn({
      userId: req.userId,
      currency,
      network,
      minAmount: minAmount != null ? parseFloat(minAmount) : null,
      maxAmount: maxAmount != null ? parseFloat(maxAmount) : null,
      paymentMethod,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/traders/ads/:payoutSettingId
 * Single ad detail (for order placement).
 */
router.get('/ads/:payoutSettingId', authUser, async (req, res, next) => {
  try {
    const ad = await traderAdsService.getAdById(req.params.payoutSettingId);
    if (!ad) return res.status(404).json({ error: 'Trader ad not found' });
    res.json({ success: true, data: ad });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/traders/:id/profile
 * Public trader profile for wallet users.
 */
/**
 * GET /api/v1/traders/:id/reviews
 */
router.get('/:id/reviews', authUser, async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await reviewService.listReviewsForTrader(req.params.id, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/profile', authUser, async (req, res, next) => {
  try {
    const traderId = req.params.id;
    const traderResult = await db.query(
      `SELECT id, name, trust_score, verification_status, created_at, last_seen_at
       FROM traders WHERE id = $1 AND status = 'ACTIVE'`,
      [traderId]
    );
    const trader = traderResult.rows[0];
    if (!trader) return res.status(404).json({ error: 'Trader not found' });

    const stats = await traderStatsService.getTraderStats(traderId);
    const reviews = await traderStatsService.getRecentReviews(traderId, 10);
    const online = traderStatsService.enrichOnlineStatus(trader);

    const blockedResult = await db.query(
      `SELECT 1 FROM blocked_traders WHERE user_id = $1 AND trader_id = $2`,
      [req.userId, traderId]
    );

    const adsResult = await db.query(
      `SELECT id, network, currency, min_amount, max_amount, ad_side, rate_per_usdc,
              (available_float - reserved_float) AS net_float,
              (available_usdc - reserved_usdc) AS net_usdc
       FROM trader_payout_settings
       WHERE trader_id = $1 AND is_active = TRUE
       ORDER BY ad_side, currency, network`,
      [traderId]
    );

    res.json({
      success: true,
      data: {
        id: trader.id,
        name: trader.name,
        trustScore: parseFloat(trader.trust_score),
        verificationStatus: trader.verification_status,
        memberSince: trader.created_at,
        stats,
        reviews,
        isBlocked: blockedResult.rows.length > 0,
        ...online,
        ads: adsResult.rows.map((a) => ({
          payoutSettingId: a.id,
          network: a.network,
          currency: a.currency,
          minAmount: parseFloat(a.min_amount),
          maxAmount: parseFloat(a.max_amount),
          adSide: a.ad_side || 'USER_SELL',
          ratePerUsdc: a.rate_per_usdc != null ? parseFloat(a.rate_per_usdc) : null,
          availableFloat: a.ad_side === 'USER_SELL' ? parseFloat(a.net_float) : undefined,
          availableUsdc: a.ad_side === 'USER_BUY' ? parseFloat(a.net_usdc) : undefined,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
