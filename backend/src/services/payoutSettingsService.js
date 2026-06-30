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
           available_usdc, reserved_usdc, ad_side,
           rate_per_usdc, spread_percent, fee_percent,
           is_active, created_at, updated_at
         FROM trader_payout_settings
         WHERE trader_id = $1
         ORDER BY ad_side, created_at DESC`,
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
           available_usdc, reserved_usdc, ad_side,
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
      available_float = 0,
      available_usdc = 0,
      ad_side = 'USER_SELL',
      rate_per_usdc,
      spread_percent,
      fee_percent,
    } = data;

    const isBuyAd = ad_side === 'USER_BUY';

    if (!country || !network || !currency || min_amount === undefined || max_amount === undefined) {
      const err = new Error('Missing required fields: country, network, currency, min_amount, max_amount');
      err.status = 400;
      throw err;
    }

    if (isBuyAd && (!available_usdc || available_usdc <= 0)) {
      const err = new Error('available_usdc is required for buy ads');
      err.status = 400;
      throw err;
    }
    if (!isBuyAd && available_float === undefined) {
      const err = new Error('available_float is required for sell ads');
      err.status = 400;
      throw err;
    }

    if (max_amount <= min_amount) {
      const err = new Error('max_amount must be greater than min_amount');
      err.status = 400;
      throw err;
    }

    if (min_amount < 0 || max_amount < 0 || available_float < 0 || available_usdc < 0) {
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
          available_usdc, ad_side, rate_per_usdc, spread_percent, fee_percent, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
         RETURNING id, trader_id, country, network, currency,
                   min_amount, max_amount, available_float, reserved_float,
                   available_usdc, reserved_usdc, ad_side,
                   rate_per_usdc, spread_percent, fee_percent,
                   is_active, created_at, updated_at`,
        [
          traderId, country, network, currency, min_amount, max_amount,
          isBuyAd ? 0 : available_float,
          isBuyAd ? available_usdc : 0,
          ad_side,
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
    if (data.available_usdc !== undefined) {
      updates.push(`available_usdc = $${paramIndex++}::NUMERIC`);
      values.push(data.available_usdc);
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
    const availUsdc = data.available_usdc !== undefined ? data.available_usdc : existing.available_usdc;

    if (maxAmt <= minAmt) {
      const err = new Error('max_amount must be greater than min_amount');
      err.status = 400;
      throw err;
    }

    if (minAmt < 0 || maxAmt < 0 || availFloat < 0 || (availUsdc != null && availUsdc < 0)) {
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
                     WHERE id = $${paramIndex} AND trader_id = $${paramIndex + 1}
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

  /**
   * Phase 3: Reserve float for a matched transaction
   * Atomically increments reserved_float when trader is assigned
   */
  async reserveFloat(payoutSettingId, fiatAmount) {
    try {
      // Validate amount
      if (fiatAmount <= 0) {
        const err = new Error('Fiat amount must be greater than 0');
        err.status = 400;
        throw err;
      }

      // Atomically reserve: check still available, increment reserved_float
      const result = await db.query(
        `UPDATE trader_payout_settings
         SET reserved_float = reserved_float + $1,
             updated_at = NOW()
         WHERE id = $2
           AND (available_float - reserved_float) >= $1
         RETURNING id, trader_id, network, currency, available_float, reserved_float`,
        [fiatAmount, payoutSettingId]
      );

      if (result.rows.length === 0) {
        const err = new Error('Insufficient available float to reserve');
        err.status = 409;
        throw err;
      }

      const setting = result.rows[0];
      logger.info(`[Float] Reserved ${fiatAmount} for payout setting ${payoutSettingId} (${setting.network}/${setting.currency}). Reserved now: ${setting.reserved_float + fiatAmount}`);
      return setting;
    } catch (err) {
      logger.error('PayoutSettingsService.reserveFloat', err);
      throw err;
    }
  }

  /**
   * Phase 3: Release reserved float (trader declined or request expired)
   * Atomically decrements reserved_float back
   */
  async releaseReservedFloat(payoutSettingId, fiatAmount) {
    try {
      // Validate amount
      if (fiatAmount <= 0) {
        const err = new Error('Fiat amount must be greater than 0');
        err.status = 400;
        throw err;
      }

      // Atomically release: decrement reserved_float, ensure non-negative
      const result = await db.query(
        `UPDATE trader_payout_settings
         SET reserved_float = GREATEST(0, reserved_float - $1),
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, trader_id, network, currency, available_float, reserved_float`,
        [fiatAmount, payoutSettingId]
      );

      if (result.rows.length === 0) {
        logger.warn(`PayoutSettingsService.releaseReservedFloat: Setting ${payoutSettingId} not found`);
        return null;
      }

      const setting = result.rows[0];
      logger.info(`[Float] Released ${fiatAmount} reservation for payout setting ${payoutSettingId} (${setting.network}/${setting.currency}). Reserved now: ${setting.reserved_float}`);
      return setting;
    } catch (err) {
      logger.error('PayoutSettingsService.releaseReservedFloat', err);
      throw err;
    }
  }

  /**
   * Phase 3: Finalize float deduction (transaction completed)
   * Atomically decrements both available_float and reserved_float
   * Once per transaction (use idempotency key or check state)
   */
  async finalizeFloat(payoutSettingId, fiatAmount) {
    try {
      // Validate amount
      if (fiatAmount <= 0) {
        const err = new Error('Fiat amount must be greater than 0');
        err.status = 400;
        throw err;
      }

      // Atomically finalize: decrement both available and reserved
      const result = await db.query(
        `UPDATE trader_payout_settings
         SET available_float = GREATEST(0, available_float - $1),
             reserved_float = GREATEST(0, reserved_float - $1),
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, trader_id, network, currency, available_float, reserved_float`,
        [fiatAmount, payoutSettingId]
      );

      if (result.rows.length === 0) {
        logger.warn(`PayoutSettingsService.finalizeFloat: Setting ${payoutSettingId} not found`);
        return null;
      }

      const setting = result.rows[0];
      logger.info(`[Float] Finalized ${fiatAmount} for payout setting ${payoutSettingId} (${setting.network}/${setting.currency}). Available now: ${setting.available_float}, Reserved now: ${setting.reserved_float}`);
      return setting;
    } catch (err) {
      logger.error('PayoutSettingsService.finalizeFloat', err);
      throw err;
    }
  }

  /**
   * [PHASE 2H] Release a match-time float reservation when declining / rematching /
   * unassigning. Does NOT claim float_settled (unlike releaseReservationForTransaction).
   * Atomically clears payout_setting_id so duplicate calls are no-ops.
   */
  async releaseMatchReservationIfAssigned(transactionId) {
    const result = await db.query(
      `WITH target AS (
         SELECT id, payout_setting_id, fiat_amount
         FROM transactions
         WHERE id = $1
           AND payout_setting_id IS NOT NULL
           AND float_settled = FALSE
         FOR UPDATE
       )
       UPDATE transactions t
       SET payout_setting_id = NULL, updated_at = NOW()
       FROM target src
       WHERE t.id = src.id
       RETURNING src.payout_setting_id, src.fiat_amount`,
      [transactionId]
    );
    if (!result.rows[0]) {
      return { released: false, reason: 'no_active_reservation' };
    }
    const { payout_setting_id, fiat_amount } = result.rows[0];
    const amount = parseFloat(fiat_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      logger.warn(`[Float] releaseMatchReservationIfAssigned: tx ${transactionId} invalid fiat_amount`);
      return { released: false, reason: 'invalid_amount' };
    }
    await this.releaseReservedFloat(payout_setting_id, amount);
    logger.info(`[Float] Released match reservation for tx ${transactionId} on setting ${payout_setting_id}`);
    return { released: true, payoutSettingId: payout_setting_id, amount };
  }

  /**
   * [PHASE 2A] Idempotently claim the one-time "float settlement" for a transaction.
   * Uses transactions.float_settled as the guard so finalize / release-reservation
   * runs AT MOST ONCE per transaction, regardless of job retries or concurrent calls.
   *
   * @returns {boolean} true if THIS caller won the claim (must perform the settlement),
   *                    false if it was already settled (caller must do nothing).
   */
  async claimFloatSettlement(transactionId) {
    const result = await db.query(
      `UPDATE transactions
       SET float_settled = TRUE, float_settled_at = NOW()
       WHERE id = $1 AND float_settled = FALSE
       RETURNING id`,
      [transactionId]
    );
    return result.rows.length > 0;
  }

  /** Undo a float-settlement claim (used if the settlement itself fails). */
  async unclaimFloatSettlement(transactionId) {
    await db.query(
      `UPDATE transactions SET float_settled = FALSE, float_settled_at = NULL WHERE id = $1`,
      [transactionId]
    );
  }

  /**
   * [PHASE 2A] Canonical, idempotent float FINALIZE for a transaction
   * (normal completion + trader-win dispute). Decrements BOTH available_float
   * and reserved_float exactly once. Native-currency amount.
   */
  async finalizeFloatForTransaction(transactionId, payoutSettingId, fiatAmount) {
    if (!payoutSettingId) {
      logger.warn(`[Float] finalizeFloatForTransaction: tx ${transactionId} has NULL payout_setting_id (legacy). Skipping payout-setting float finalize — no canonical float to settle.`);
      return { skipped: true, reason: 'no_payout_setting' };
    }
    const won = await this.claimFloatSettlement(transactionId);
    if (!won) {
      logger.info(`[Float] finalizeFloatForTransaction: tx ${transactionId} already settled — skipping (idempotent).`);
      return { skipped: true, reason: 'already_settled' };
    }
    try {
      const setting = await this.finalizeFloat(payoutSettingId, parseFloat(fiatAmount));
      return { skipped: false, setting };
    } catch (err) {
      // Roll back the claim so a retry can finalize.
      await this.unclaimFloatSettlement(transactionId).catch(() => {});
      throw err;
    }
  }

  /**
   * [PHASE 2A] Canonical, idempotent reservation RELEASE for a transaction
   * (user-win dispute, or matched-then-refunded). Decrements reserved_float ONLY,
   * leaving available_float intact. Native-currency amount.
   */
  async releaseReservationForTransaction(transactionId, payoutSettingId, fiatAmount) {
    if (!payoutSettingId) {
      logger.warn(`[Float] releaseReservationForTransaction: tx ${transactionId} has NULL payout_setting_id (legacy). Skipping reservation release.`);
      return { skipped: true, reason: 'no_payout_setting' };
    }
    const won = await this.claimFloatSettlement(transactionId);
    if (!won) {
      logger.info(`[Float] releaseReservationForTransaction: tx ${transactionId} already settled — skipping (idempotent).`);
      return { skipped: true, reason: 'already_settled' };
    }
    try {
      const setting = await this.releaseReservedFloat(payoutSettingId, parseFloat(fiatAmount));
      return { skipped: false, setting };
    } catch (err) {
      await this.unclaimFloatSettlement(transactionId).catch(() => {});
      throw err;
    }
  }

  /**
   * Aggregate active payout limits for a network (used at quote time).
   */
  async getActiveNetworkLimits(network, currency) {
    const result = await db.query(
      `SELECT
         MIN(min_amount) AS min_fiat,
         MAX(max_amount) AS max_fiat,
         COUNT(*)::int AS active_traders
       FROM trader_payout_settings ps
       JOIN traders t ON t.id = ps.trader_id
       WHERE ps.network = $1::mobile_network
         AND ps.currency = $2
         AND ps.is_active = TRUE
         AND t.status = 'ACTIVE'
         AND t.verification_status = 'VERIFIED'
         AND t.stellar_address IS NOT NULL`,
      [network, currency]
    );
    const row = result.rows[0];
    const activeTraders = row?.active_traders || 0;
    return {
      hasTraders: activeTraders > 0,
      minFiat: row?.min_fiat != null ? parseFloat(row.min_fiat) : null,
      maxFiat: row?.max_fiat != null ? parseFloat(row.max_fiat) : null,
      activeTraders,
    };
  }

  /**
   * All active network limits for client display (cashout-limits endpoint).
   */
  async getAllActiveNetworkLimits() {
    const result = await db.query(
      `SELECT ps.network, ps.currency,
              MIN(ps.min_amount) AS min_fiat,
              MAX(ps.max_amount) AS max_fiat,
              COUNT(DISTINCT ps.trader_id)::int AS active_traders
       FROM trader_payout_settings ps
       JOIN traders t ON t.id = ps.trader_id
       WHERE ps.is_active = TRUE
         AND t.status = 'ACTIVE'
         AND t.verification_status = 'VERIFIED'
         AND t.stellar_address IS NOT NULL
       GROUP BY ps.network, ps.currency
       ORDER BY ps.network`
    );
    return result.rows.map((row) => ({
      network: row.network,
      currency: row.currency,
      minFiat: parseFloat(row.min_fiat),
      maxFiat: parseFloat(row.max_fiat),
      activeTraders: row.active_traders,
    }));
  }

  async reserveUsdcFloat(payoutSettingId, usdcAmount) {
    if (usdcAmount <= 0) {
      const err = new Error('USDC amount must be greater than 0');
      err.status = 400;
      throw err;
    }
    const result = await db.query(
      `UPDATE trader_payout_settings
       SET reserved_usdc = reserved_usdc + $1, updated_at = NOW()
       WHERE id = $2 AND ad_side = 'USER_BUY'
         AND (available_usdc - reserved_usdc) >= $1
       RETURNING id, available_usdc, reserved_usdc`,
      [usdcAmount, payoutSettingId]
    );
    if (result.rows.length === 0) {
      const err = new Error('Insufficient USDC float to reserve');
      err.status = 409;
      throw err;
    }
    return result.rows[0];
  }

  async releaseReservedUsdcFloat(payoutSettingId, usdcAmount) {
    const result = await db.query(
      `UPDATE trader_payout_settings
       SET reserved_usdc = GREATEST(0, reserved_usdc - $1), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [usdcAmount, payoutSettingId]
    );
    return result.rows[0] || null;
  }

  async finalizeUsdc(payoutSettingId, usdcAmount) {
    const result = await db.query(
      `UPDATE trader_payout_settings
       SET available_usdc = GREATEST(0, available_usdc - $1),
           reserved_usdc = GREATEST(0, reserved_usdc - $1),
           updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [usdcAmount, payoutSettingId]
    );
    return result.rows[0] || null;
  }

  async finalizeUsdcFloatForTransaction(transactionId, payoutSettingId, usdcAmount) {
    if (!payoutSettingId) return { skipped: true };
    const won = await this.claimFloatSettlement(transactionId);
    if (!won) return { skipped: true, reason: 'already_settled' };
    try {
      return { skipped: false, setting: await this.finalizeUsdc(payoutSettingId, parseFloat(usdcAmount)) };
    } catch (err) {
      await this.unclaimFloatSettlement(transactionId).catch(() => {});
      throw err;
    }
  }

  async getActiveBuyNetworkLimits(network, currency) {
    const result = await db.query(
      `SELECT MIN(min_amount) AS min_fiat, MAX(max_amount) AS max_fiat, COUNT(*)::int AS active_traders
       FROM trader_payout_settings ps
       JOIN traders t ON t.id = ps.trader_id
       WHERE ps.network = $1::mobile_network AND ps.currency = $2
         AND ps.ad_side = 'USER_BUY' AND ps.is_active = TRUE
         AND (ps.available_usdc - ps.reserved_usdc) > 0
         AND t.status = 'ACTIVE' AND t.verification_status = 'VERIFIED'`,
      [network, currency]
    );
    const row = result.rows[0];
    return {
      hasTraders: (row?.active_traders || 0) > 0,
      minFiat: row?.min_fiat != null ? parseFloat(row.min_fiat) : null,
      maxFiat: row?.max_fiat != null ? parseFloat(row.max_fiat) : null,
      activeTraders: row?.active_traders || 0,
    };
  }
}

export default new PayoutSettingsService();
