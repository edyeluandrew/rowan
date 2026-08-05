import { Router } from 'express';
import paymentRouter from '../services/payments/paymentRouter.js';
import yellowPayProvider from '../services/payments/providers/yellowPayProvider.js';
import config from '../config/index.js';
import { PAYMENT_SIDES } from '../services/payments/paymentConstants.js';

const router = Router();

/**
 * GET /api/v1/payments/routes
 * Public corridor routing (P2P default; Yellow Pay if configured).
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
 * Aggregator health for ops / client feature flags.
 */
router.get('/providers/status', (_req, res) => {
  const yc = config.yellowPay || {};
  res.json({
    status: 'ok',
    data: {
      yellowPay: {
        enabled: yc.enabled,
        mockMode: yellowPayProvider.yellowPayIsMock(),
        configured: Boolean(yc.clientId && yc.clientSecret) || Boolean(yc.apiKey),
        sandboxCorridors: yc.sandboxCorridors || [],
        baseUrl: yc.baseUrl,
      },
      p2pTrader: { enabled: true },
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
