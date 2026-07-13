import { Router } from 'express';
import { authUser } from '../middleware/auth.js';
import { validate, validateTypes } from '../middleware/validate.js';
import expressMatchingService from '../services/expressMatchingService.js';

const router = Router();

/**
 * POST /api/v1/express/preview
 * Non-committing best-match quote for the Express sheet.
 * Buy: fiatAmount → estimated USDC + best seller
 * Sell: usdcAmount → estimated fiat + best buyer (float trader)
 */
router.post(
  '/preview',
  authUser,
  validate(['side', 'network']),
  validateTypes({
    network: 'mobileNetwork',
    fiatAmount: 'positiveNumber',
    usdcAmount: 'positiveNumber',
  }),
  async (req, res, next) => {
    try {
      const side = String(req.body.side || '').toLowerCase();
      if (side !== 'buy' && side !== 'sell') {
        return res.status(400).json({ error: 'side must be buy or sell' });
      }

      const preview = await expressMatchingService.previewExpress({
        side,
        network: req.body.network,
        fiatAmount: req.body.fiatAmount,
        usdcAmount: req.body.usdcAmount,
        userId: req.userId,
      });

      res.json(preview);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      next(err);
    }
  }
);

export default router;
