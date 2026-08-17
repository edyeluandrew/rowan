import { Router } from 'express';
import paymentRouter from '../services/payments/paymentRouter.js';
import marzPayProvider from '../services/payments/providers/marzPayProvider.js';
import config from '../config/index.js';
import { PAYMENT_SIDES } from '../services/payments/paymentConstants.js';

const router = Router();

/**
 * GET /api/v1/payments/routes
 * Public corridor routing (P2P for buy/sell).
 * ?country=UG&side=offramp
 */
router.get('/routes', (req, res) => {
  const country = String(req.query.country || '').trim().toUpperCase();
  const side = String(req.query.side || PAYMENT_SIDES.OFFRAMP).toLowerCase();

  if (country) {
    const plan = paymentRouter.resolvePaymentPlan({ countryCode: country, side });
    return res.json({ status: 'ok', data: plan, timestamp: new Date().toISOString() });
  }

  res.json({
    status: 'ok',
    data: paymentRouter.getAllCorridorSummaries(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/payments/providers/status
 * Rail health for ops / client feature flags.
 */
router.get('/providers/status', (_req, res) => {
  const mz = config.marzPay || {};
  res.json({
    status: 'ok',
    data: {
      marzPay: {
        enabled: mz.enabled,
        buySellEnabled: Boolean(mz.buySellEnabled),
        utilitiesOnly: !mz.buySellEnabled,
        mockMode: marzPayProvider.marzPayIsMock(),
        configured: Boolean(mz.apiKey && mz.apiSecret),
        offrampCountries: mz.offrampCountries || [],
        onrampCountries: mz.onrampCountries || [],
        settlementConfigured: Boolean(mz.settlementStellarAddress),
        webhookSigning: Boolean(mz.webhookSecret),
      },
      p2pTrader: { enabled: true },
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
