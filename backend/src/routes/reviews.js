import { Router } from 'express';
import { authUser, authTrader } from '../middleware/auth.js';
import reviewService from '../services/reviewService.js';

const router = Router();

/**
 * POST /api/v1/reviews
 * Body: { transactionId, rating (1|-1), comment? }
 * Wallet user submits review for trader.
 */
router.post('/', authUser, async (req, res, next) => {
  try {
    const { transactionId, rating, comment } = req.body;
    if (!transactionId || rating == null) {
      return res.status(400).json({ error: 'transactionId and rating are required' });
    }
    const review = await reviewService.createReview({
      transactionId,
      reviewerId: req.userId,
      reviewerRole: 'user',
      rating: parseInt(rating, 10),
      comment,
    });
    res.status(201).json({ success: true, data: review });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

/**
 * POST /api/v1/reviews/trader
 * Trader reviews the buyer after COMPLETE.
 */
router.post('/trader', authTrader, async (req, res, next) => {
  try {
    const { transactionId, rating, comment } = req.body;
    if (!transactionId || rating == null) {
      return res.status(400).json({ error: 'transactionId and rating are required' });
    }
    const review = await reviewService.createReview({
      transactionId,
      reviewerId: req.traderId,
      reviewerRole: 'trader',
      rating: parseInt(rating, 10),
      comment,
    });
    res.status(201).json({ success: true, data: review });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

/**
 * GET /api/v1/reviews/trader/status/:transactionId
 * Check if current trader already submitted a review.
 */
router.get('/trader/status/:transactionId', authTrader, async (req, res, next) => {
  try {
    const status = await reviewService.getReviewStatus(
      req.params.transactionId,
      req.traderId,
      'trader'
    );
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reviews/status/:transactionId
 * Check if current user/trader already submitted a review.
 */
router.get('/status/:transactionId', authUser, async (req, res, next) => {
  try {
    const status = await reviewService.getReviewStatus(
      req.params.transactionId,
      req.userId,
      'user'
    );
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reviews/trader/:traderId
 * Paginated reviews for a trader (also mounted at /traders/:id/reviews).
 */
router.get('/trader/:traderId', authUser, async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await reviewService.listReviewsForTrader(req.params.traderId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
