/**
 * Trader Payout Settings Routes
 * POST/GET/PUT/DELETE endpoints for trader payout settings
 */

import { Router } from 'express';
import { authTrader } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import payoutSettingsService from '../services/payoutSettingsService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/trader/payout-settings
 * Get all payout settings for the authenticated trader
 */
router.get('/', authTrader, async (req, res, next) => {
  try {
    const traderId = req.user.id;
    const settings = await payoutSettingsService.getPayoutSettingsByTrader(traderId);
    
    res.json({
      success: true,
      data: settings,
      count: settings.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/payout-settings/:id
 * Get a specific payout setting
 */
router.get('/:id', authTrader, async (req, res, next) => {
  try {
    const { id } = req.params;
    const traderId = req.user.id;

    const setting = await payoutSettingsService.getPayoutSettingById(id, traderId);
    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Payout setting not found',
      });
    }

    res.json({
      success: true,
      data: setting,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/trader/payout-settings
 * Create a new payout setting
 * Body: { country, network, currency, min_amount, max_amount, available_float, 
 *         rate_per_usdc?, spread_percent?, fee_percent? }
 */
router.post(
  '/',
  authTrader,
  validate(['country', 'network', 'currency', 'min_amount', 'max_amount', 'available_float']),
  async (req, res, next) => {
    try {
      const traderId = req.user.id;
      const {
        country,
        network,
        currency,
        min_amount,
        max_amount,
        available_float,
        rate_per_usdc,
        spread_percent,
        fee_percent,
      } = req.body;

      const setting = await payoutSettingsService.createPayoutSetting(traderId, {
        country,
        network,
        currency,
        min_amount: parseFloat(min_amount),
        max_amount: parseFloat(max_amount),
        available_float: parseFloat(available_float),
        rate_per_usdc: rate_per_usdc ? parseFloat(rate_per_usdc) : null,
        spread_percent: spread_percent ? parseFloat(spread_percent) : null,
        fee_percent: fee_percent ? parseFloat(fee_percent) : null,
      });

      res.status(201).json({
        success: true,
        data: setting,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/v1/trader/payout-settings/:id
 * Update an existing payout setting
 * Body: { country?, network?, currency?, min_amount?, max_amount?, available_float?,
 *         rate_per_usdc?, spread_percent?, fee_percent?, is_active? }
 */
router.put('/:id', authTrader, async (req, res, next) => {
  try {
    const { id } = req.params;
    const traderId = req.user.id;
    const {
      country,
      min_amount,
      max_amount,
      available_float,
      rate_per_usdc,
      spread_percent,
      fee_percent,
      is_active,
    } = req.body;

    const updateData = {};
    if (country !== undefined) updateData.country = country;
    if (min_amount !== undefined) updateData.min_amount = parseFloat(min_amount);
    if (max_amount !== undefined) updateData.max_amount = parseFloat(max_amount);
    if (available_float !== undefined) updateData.available_float = parseFloat(available_float);
    if (rate_per_usdc !== undefined) updateData.rate_per_usdc = rate_per_usdc ? parseFloat(rate_per_usdc) : null;
    if (spread_percent !== undefined) updateData.spread_percent = spread_percent ? parseFloat(spread_percent) : null;
    if (fee_percent !== undefined) updateData.fee_percent = fee_percent ? parseFloat(fee_percent) : null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const setting = await payoutSettingsService.updatePayoutSetting(id, traderId, updateData);

    res.json({
      success: true,
      data: setting,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/trader/payout-settings/:id
 * Delete a payout setting
 */
router.delete('/:id', authTrader, async (req, res, next) => {
  try {
    const { id } = req.params;
    const traderId = req.user.id;

    const result = await payoutSettingsService.deletePayoutSetting(id, traderId);

    res.json({
      success: true,
      message: 'Payout setting deleted',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/trader/payout-settings/:id/toggle
 * Toggle active/inactive status
 * Body: { is_active: boolean }
 */
router.patch('/:id/toggle', authTrader, validate(['is_active']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const traderId = req.user.id;

    const setting = await payoutSettingsService.togglePayoutSettingStatus(
      id,
      traderId,
      is_active
    );

    res.json({
      success: true,
      data: setting,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
