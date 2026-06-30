/**
 * Payout Settings API Client
 * Methods for CRUD operations on trader payout settings
 */

import client from './client';

const BASE_URL = '/api/v1/trader/payout-settings';

export const payoutSettingsAPI = {
  /**
   * Fetch all payout settings for the trader
   */
  async fetchPayoutSettings() {
    try {
      const response = await client.get(BASE_URL);
      return response.data;
    } catch (error) {
      console.error('Error fetching payout settings:', error);
      throw error;
    }
  },

  /**
   * Fetch a single payout setting by ID
   */
  async fetchPayoutSetting(id) {
    try {
      const response = await client.get(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching payout setting:', error);
      throw error;
    }
  },

  /**
   * Create a new payout setting
   * @param {Object} data - Setting data
   * @param {string} data.country - Country code (e.g., 'UG', 'KE', 'TZ')
   * @param {string} data.network - Mobile network (MTN_UG, AIRTEL_UG, M_PESA_KE, etc.)
   * @param {string} data.currency - Currency code (UGX, KES, TZS)
   * @param {number} data.min_amount - Minimum payout amount
   * @param {number} data.max_amount - Maximum payout amount
   * @param {number} [data.available_float] - Available fiat float (USER_SELL)
   * @param {number} [data.available_usdc] - Available USDC inventory (USER_BUY)
   * @param {string} [data.ad_side] - USER_SELL | USER_BUY
   * @param {number} [data.rate_per_usdc] - Optional USDC rate
   * @param {number} [data.spread_percent] - Optional spread percentage (0-100)
   * @param {number} [data.fee_percent] - Optional fee percentage (0-100)
   */
  async createPayoutSetting(data) {
    try {
      const response = await client.post(BASE_URL, data);
      return response.data;
    } catch (error) {
      console.error('Error creating payout setting:', error);
      throw error;
    }
  },

  /**
   * Update an existing payout setting
   * @param {string} id - Setting ID
   * @param {Object} data - Updated setting data (partial)
   */
  async updatePayoutSetting(id, data) {
    try {
      const response = await client.put(`${BASE_URL}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating payout setting:', error);
      throw error;
    }
  },

  /**
   * Delete a payout setting
   * @param {string} id - Setting ID
   */
  async deletePayoutSetting(id) {
    try {
      const response = await client.delete(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting payout setting:', error);
      throw error;
    }
  },

  /**
   * Toggle active/inactive status
   * @param {string} id - Setting ID
   * @param {boolean} isActive - New active status
   */
  async togglePayoutSettingStatus(id, isActive) {
    try {
      const response = await client.patch(`${BASE_URL}/${id}/toggle`, {
        is_active: isActive,
      });
      return response.data;
    } catch (error) {
      console.error('Error toggling payout setting status:', error);
      throw error;
    }
  },
};

export default payoutSettingsAPI;
