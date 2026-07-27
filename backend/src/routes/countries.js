import { Router } from 'express';
import countryService from '../services/countries/countryService.js';

const router = Router();

/**
 * GET /api/v1/countries
 * Public list of active countries with mobile money payment methods.
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    data: countryService.getCountryOptionsForClient(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/countries/:code
 * Single country detail (404 if inactive or unknown).
 */
router.get('/:code', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const country = countryService.getCountry(code);

  if (!country) {
    return res.status(404).json({ error: 'Country not found or not active' });
  }

  res.json({
    status: 'ok',
    data: {
      ...country,
      paymentMethods: countryService.getPaymentMethods(code),
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
