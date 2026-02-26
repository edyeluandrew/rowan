import { Router } from 'express';
import quoteEngine from '../services/quoteEngine.js';

const router = Router();

/**
 * GET /api/v1/rates/current
 * Get the current XLM indicative rate for a given fiat currency.
 * NOT locked — for display only.
 * Query: ?currency=UGX (default: UGX)
 */
router.get('/current', async (req, res, next) => {
  try {
    const currency = (req.query.currency || 'UGX').toUpperCase();
    const validCurrencies = ['UGX', 'KES', 'TZS'];

    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({
        error: `Unsupported currency. Use one of: ${validCurrencies.join(', ')}`,
      });
    }

    const rate = await quoteEngine.getXlmRate(currency);

    res.json({
      currency,
      xlmRate: rate,
      usdcToFiat: quoteEngine.getUsdcToFiatRate(currency),
      source: 'stellar_dex',
      disclaimer: 'Indicative rate only. Request a quote for a locked rate.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/rates/all
 * Get rates for all supported currencies at once.
 */
router.get('/all', async (req, res, next) => {
  try {
    const currencies = ['UGX', 'KES', 'TZS'];
    const rates = {};

    for (const currency of currencies) {
      try {
        rates[currency] = await quoteEngine.getXlmRate(currency);
      } catch {
        rates[currency] = null;
      }
    }

    res.json({
      rates,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
