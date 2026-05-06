/**
 * Trader Payout Settings Service
 * Manages trader's payout network configurations with optional pricing
 */

import db from '../db/index.js';
import logger from '../utils/logger.js';

class PayoutSettingsService {
  /**
   * Get all payout settings for a trader
   */
  async getPayoutSettingsByTrader(traderId) {
    try {
      const result = await db.query(
        `SELECT 
           id, trader_id, country, network, currency,
           min_amount, max_amount, available_float, reserved_float,
           rate_per_usdc, spread_percent, fee_percent,
           is_active, created_at, updated_at
         FROM trader_payout_settings
         WHERE trader_id = $1
         ORDER BY created_at DESC`,
        [traderId]
      );
      return result.rows;
    } catch (err) {
      logger.error('PayoutSettingsService.getPayoutSettingsByTrader', err);
      throw err;
    }
  }

  /**
   * Get a single payout setting by ID
   */
  async getPayoutSettingById(id, traderId) {
    try {
      const result = await db.query(
        `SELECT 
           id, trader_id, country, network, currency,
           min_amount, max_amount, available_float, reserved_float,
           rate_per_usdc, spread_percent, fee_percent,
           is_active, created_at, updated_at
         FROM trader_payout_settings
         WHERE id = $1 AND trader_id = $2`,
        [id, traderId]
      );
      return result.rows[0] || null;
    } catch (err) {
      logger.error('PayoutSettingsService.getPayoutSettingById', err);
      throw err;
    }
  }

  /**
   * Create a new payout setting
   */
  async createPayoutSetting(traderId, data) {
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
    } = data;

    // Validation
    if (!country || !network || !currency || min_amount === undefined || max_amount === undefined || available_float === undefined) {
      const err = new Error('Missing required fields: country, network, currency, min_amount, max_amount, available_float');
      err.status = 400;
      throw err;
    }

    if (max_amount <= min_amount) {
      const err = new Error('max_amount must be greater than min_amount');
      err.status = 400;
      throw err;
    }

    if (min_amount < 0 || max_amount < 0 || available_float < 0) {
      const err = new Error('Amounts cannot be negative');
      err.status = 400;
      throw err;
    }

    if (rate_per_usdc !== null && rate_per_usdc !== undefined && rate_per_usdc <= 0) {
      const err = new Error('rate_per_usdc must be greater than 0');
      err.status = 400;
      throw err;
    }

    if (spread_percent !== null && spread_percent !== undefined && (spread_percent < 0 || spread_percent > 100)) {
      const err = new Error('spread_percent must be between 0 and 100');
      err.status = 400;
      throw err;
    }

    if (fee_percent !== null && fee_percent !== undefined && (fee_percent < 0 || fee_percent > 100)) {
      const err = new Error('fee_percent must be between 0 and 100');
      err.status = 400;
      throw err;
    }

    try {
      const result = await db.query(
        `INSERT INTO trader_payout_settings
         (trader_id, country, network, currency, min_amount, max_amount, available_float,
          rate_per_usdc, spread_percent, fee_percent, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
         RETURNING id, trader_id, country, network, currency,
                   min_amount, max_amount, available_float, reserved_float,
                   rate_per_usdc, spread_percent, fee_percent,
                   is_active, created_at, updated_at`,
        [
          traderId, country, network, currency, min_amount, max_amount, available_float,
          rate_per_usdc || null, spread_percent || null, fee_percent || null,
        ]
      );
      logger.info(`Created payout setting for trader ${traderId}: ${network} ${currency}`);
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        // Unique constraint violation
        const constraintErr = new Error(`Trader already has a payout setting for ${network} in ${currency}`);
        constraintErr.status = 409;
        throw constraintErr;
      }
      logger.error('PayoutSettingsService.createPayoutSetting', err);
      throw err;
    }
  }

  /**
   * Update an existing payout setting
   */
  async updatePayoutSetting(id, traderId, data) {
    // Validate ownership first
    const existing = await this.getPayoutSettingById(id, traderId);
    if (!existing) {
      const err = new Error('Payout setting not found or access denied');
      err.status = 404;
      throw err;
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (data.country !== undefined) {
      updates.push(`country = $${paramIndex++}`);
      values.push(data.country);
    }
    if (data.min_amount !== undefined) {
      updates.push(`min_amount = $${paramIndex++}::NUMERIC`);
      values.push(data.min_amount);
    }
    if (data.max_amount !== undefined) {
      updates.push(`max_amount = $${paramIndex++}::NUMERIC`);
      values.push(data.max_amount);
    }
    if (data.available_float !== undefined) {
      updates.push(`available_float = $${paramIndex++}::NUMERIC`);
      values.push(data.available_float);
    }
    if (data.rate_per_usdc !== undefined) {
      updates.push(`rate_per_usdc = $${paramIndex++}::NUMERIC`);
      values.push(data.rate_per_usdc);
    }
    if (data.spread_percent !== undefined) {
      updates.push(`spread_percent = $${paramIndex++}::NUMERIC`);
      values.push(data.spread_percent);
    }
    if (data.fee_percent !== undefined) {
      updates.push(`fee_percent = $${paramIndex++}::NUMERIC`);
      values.push(data.fee_percent);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      return existing; // No changes
    }

    // Validate constraints
    const minAmt = data.min_amount !== undefined ? data.min_amount : existing.min_amount;
    const maxAmt = data.max_amount !== undefined ? data.max_amount : existing.max_amount;
    const availFloat = data.available_float !== undefined ? data.available_float : existing.available_float;

    if (maxAmt <= minAmt) {
      const err = new Error('max_amount must be greater than min_amount');
      err.status = 400;
      throw err;
    }

    if (minAmt < 0 || maxAmt < 0 || availFloat < 0) {
      const err = new Error('Amounts cannot be negative');
      err.status = 400;
      throw err;
    }

    if (data.rate_per_usdc !== undefined && data.rate_per_usdc !== null && data.rate_per_usdc <= 0) {
      const err = new Error('rate_per_usdc must be greater than 0');
      err.status = 400;
      throw err;
    }

    if (data.spread_percent !== undefined && data.spread_percent !== null && (data.spread_percent < 0 || data.spread_percent > 100)) {
      const err = new Error('spread_percent must be between 0 and 100');
      err.status = 400;
      throw err;
    }

    if (data.fee_percent !== undefined && data.fee_percent !== null && (data.fee_percent < 0 || data.fee_percent > 100)) {
      const err = new Error('fee_percent must be between 0 and 100');
      err.status = 400;
      throw err;
    }

    try {
      values.push(id);
      values.push(traderId);

      const query = `UPDATE trader_payout_settings
                     SET ${updates.join(', ')}
                     WHERE id = $${paramIndex + 1} AND trader_id = $${paramIndex + 2}
                     RETURNING id, trader_id, country, network, currency,
                               min_amount, max_amount, available_float, reserved_float,
                               rate_per_usdc, spread_percent, fee_percent,
                               is_active, created_at, updated_at`;

      const result = await db.query(query, values);
      logger.info(`Updated payout setting ${id} for trader ${traderId}`);
      return result.rows[0];
    } catch (err) {
      logger.error('PayoutSettingsService.updatePayoutSetting', err);
      throw err;
    }
  }

  /**
   * Delete a payout setting
   */
  async deletePayoutSetting(id, traderId) {
    try {
      const result = await db.query(
        `DELETE FROM trader_payout_settings
         WHERE id = $1 AND trader_id = $2
         RETURNING id`,
        [id, traderId]
      );

      if (result.rows.length === 0) {
        const err = new Error('Payout setting not found or access denied');
        err.status = 404;
        throw err;
      }

      logger.info(`Deleted payout setting ${id} for trader ${traderId}`);
      return { success: true, id };
    } catch (err) {
      logger.error('PayoutSettingsService.deletePayoutSetting', err);
      throw err;
    }
  }

  /**
   * Toggle active/inactive status
   */
  async togglePayoutSettingStatus(id, traderId, isActive) {
    try {
      const result = await db.query(
        `UPDATE trader_payout_settings
         SET is_active = $1
         WHERE id = $2 AND trader_id = $3
         RETURNING id, trader_id, country, network, currency,
                   min_amount, max_amount, available_float, reserved_float,
                   rate_per_usdc, spread_percent, fee_percent,
                   is_active, created_at, updated_at`,
        [isActive, id, traderId]
      );

      if (result.rows.length === 0) {
        const err = new Error('Payout setting not found or access denied');
        err.status = 404;
        throw err;
      }

      logger.info(`Toggled payout setting ${id} status to ${isActive}`);
      return result.rows[0];
    } catch (err) {
      logger.error('PayoutSettingsService.togglePayoutSettingStatus', err);
      throw err;
    }
  }
}

export default new PayoutSettingsService();
