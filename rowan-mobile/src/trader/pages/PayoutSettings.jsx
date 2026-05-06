/**
 * Trader Payout Settings Page
 * Manage payout networks and optional pricing for cashout
 */

import React, { useState, useEffect } from 'react';
import { ChevronRight, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import payoutSettingsAPI from '../api/payoutSettings';


const NETWORKS = ['MTN_UG', 'AIRTEL_UG', 'M_PESA_KE', 'MTN_TZ', 'AIRTEL_TZ'];
const CURRENCIES = ['UGX', 'KES', 'TZS'];
const COUNTRIES = {
  UG: 'Uganda',
  KE: 'Kenya',
  TZ: 'Tanzania',
};

const PayoutSettings = () => {
  const { trader } = useAuth();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(getEmptyFormData());

  function getEmptyFormData() {
    return {
      country: '',
      network: '',
      currency: '',
      min_amount: '',
      max_amount: '',
      available_float: '',
      rate_per_usdc: '',
      spread_percent: '',
      fee_percent: '',
    };
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const response = await payoutSettingsAPI.fetchPayoutSettings();
      setSettings(response.data || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch payout settings:', err);
      setError('Failed to load payout settings');
    } finally {
      setLoading(false);
    }
  }

  const handleAddClick = () => {
    setEditingId(null);
    setFormData(getEmptyFormData());
    setShowForm(true);
  };

  const handleEditClick = (setting) => {
    setEditingId(setting.id);
    setFormData({
      country: setting.country,
      network: setting.network,
      currency: setting.currency,
      min_amount: setting.min_amount,
      max_amount: setting.max_amount,
      available_float: setting.available_float,
      rate_per_usdc: setting.rate_per_usdc || '',
      spread_percent: setting.spread_percent || '',
      fee_percent: setting.fee_percent || '',
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(getEmptyFormData());
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      // Validate required fields
      if (!formData.country || !formData.network || !formData.currency ||
          !formData.min_amount || !formData.max_amount || !formData.available_float) {
        setError('Please fill in all required fields');
        return;
      }

      const min = parseFloat(formData.min_amount);
      const max = parseFloat(formData.max_amount);

      if (max <= min) {
        setError('Max amount must be greater than min amount');
        return;
      }

      if (min < 0 || max < 0 || parseFloat(formData.available_float) < 0) {
        setError('Amounts cannot be negative');
        return;
      }

      const payload = {
        country: formData.country,
        network: formData.network,
        currency: formData.currency,
        min_amount: min,
        max_amount: max,
        available_float: parseFloat(formData.available_float),
        rate_per_usdc: formData.rate_per_usdc ? parseFloat(formData.rate_per_usdc) : null,
        spread_percent: formData.spread_percent ? parseFloat(formData.spread_percent) : null,
        fee_percent: formData.fee_percent ? parseFloat(formData.fee_percent) : null,
      };

      if (editingId) {
        await payoutSettingsAPI.updatePayoutSetting(editingId, payload);
      } else {
        await payoutSettingsAPI.createPayoutSetting(payload);
      }

      await fetchSettings();
      setShowForm(false);
      setFormData(getEmptyFormData());
    } catch (err) {
      console.error('Error saving payout setting:', err);
      setError(err.response?.data?.error || 'Failed to save payout setting');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this payout setting?')) return;

    try {
      await payoutSettingsAPI.deletePayoutSetting(id);
      await fetchSettings();
    } catch (err) {
      console.error('Error deleting payout setting:', err);
      setError('Failed to delete payout setting');
    }
  }

  async function handleToggle(id, currentStatus) {
    try {
      await payoutSettingsAPI.togglePayoutSettingStatus(id, !currentStatus);
      await fetchSettings();
    } catch (err) {
      console.error('Error toggling payout setting:', err);
      setError('Failed to toggle payout setting');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-yellow-900/30 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Payout Settings</h1>
          <button
            onClick={handleAddClick}
            className="bg-yellow-500 text-black rounded-lg p-2 hover:bg-yellow-400 transition"
          >
            <Plus size={24} />
          </button>
        </div>
        <p className="text-gray-400 text-sm mt-2">Manage your payout networks and pricing</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-4 mt-4 bg-red-900/20 border border-red-600 rounded-lg p-4 flex gap-3">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
          <div className="text-red-200 text-sm">{error}</div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mx-4 mt-4 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">
            {editingId ? 'Edit Payout Setting' : 'Add New Payout Setting'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Country, Network, Currency */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Country *</label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  disabled={editingId ? true : false}
                >
                  <option value="">Select</option>
                  {Object.entries(COUNTRIES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Network *</label>
                <select
                  value={formData.network}
                  onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  disabled={editingId ? true : false}
                >
                  <option value="">Select</option>
                  {NETWORKS.map((net) => (
                    <option key={net} value={net}>
                      {net}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Currency *</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  disabled={editingId ? true : false}
                >
                  <option value="">Select</option>
                  {CURRENCIES.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Min/Max Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Min Amount {formData.currency || '(select currency)'} *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.min_amount}
                  onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Max Amount {formData.currency || '(select currency)'} *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.max_amount}
                  onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Row 3: Available Float */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Available Float (USDC) *</label>
              <input
                type="number"
                step="0.0000001"
                value={formData.available_float}
                onChange={(e) => setFormData({ ...formData, available_float: e.target.value })}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                placeholder="0.0000000"
              />
              <p className="text-xs text-gray-400 mt-1">Liquidity available for payouts</p>
            </div>

            {/* Row 4: Optional Pricing Fields */}
            <div className="border-t border-gray-700 pt-4 mt-4">
              <p className="text-sm text-gray-400 mb-3">Optional Pricing (not used in matching yet)</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">USDC Rate</label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={formData.rate_per_usdc}
                    onChange={(e) => setFormData({ ...formData, rate_per_usdc: e.target.value })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                    placeholder="1.0"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Spread %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.spread_percent}
                    onChange={(e) => setFormData({ ...formData, spread_percent: e.target.value })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Fee %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.fee_percent}
                    onChange={(e) => setFormData({ ...formData, fee_percent: e.target.value })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-yellow-500 text-black font-semibold rounded-lg py-2 hover:bg-yellow-400 transition"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-gray-700 text-white font-semibold rounded-lg py-2 hover:bg-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Settings List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading payout settings...</div>
        ) : settings.length === 0 ? (
          <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
            <p className="text-gray-400 mb-3">No payout settings configured</p>
            <button
              onClick={handleAddClick}
              className="inline-flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-lg font-semibold hover:bg-yellow-400 transition"
            >
              <Plus size={18} /> Add First Setting
            </button>
          </div>
        ) : (
          settings.map((setting) => (
            <div
              key={setting.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-yellow-900/50 transition"
            >
              {/* Header: Network & Currency */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {setting.network} ({setting.currency})
                  </h3>
                  <p className="text-sm text-gray-400">{COUNTRIES[setting.country]}</p>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(setting.id, setting.is_active)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition ${
                      setting.is_active
                        ? 'bg-green-900/40 text-green-200 hover:bg-green-900/60'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {setting.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              {/* Amount Ranges */}
              <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                <div className="bg-gray-900 rounded p-3">
                  <p className="text-gray-400">Min</p>
                  <p className="font-mono text-lg text-yellow-400">
                    {setting.min_amount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-900 rounded p-3">
                  <p className="text-gray-400">Max</p>
                  <p className="font-mono text-lg text-yellow-400">
                    {setting.max_amount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-900 rounded p-3">
                  <p className="text-gray-400">Float</p>
                  <p className="font-mono text-lg text-blue-400">
                    {parseFloat(setting.available_float).toFixed(4)} USDC
                  </p>
                </div>
              </div>

              {/* Optional Pricing Info */}
              {(setting.rate_per_usdc || setting.spread_percent || setting.fee_percent) && (
                <div className="mb-3 text-xs text-gray-400 bg-gray-900 rounded p-2 space-y-1">
                  {setting.rate_per_usdc && <p>Rate: {setting.rate_per_usdc}</p>}
                  {setting.spread_percent && <p>Spread: {setting.spread_percent}%</p>}
                  {setting.fee_percent && <p>Fee: {setting.fee_percent}%</p>}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditClick(setting)}
                  className="flex-1 flex items-center justify-center gap-2 bg-yellow-500/10 text-yellow-400 rounded py-2 hover:bg-yellow-500/20 transition text-sm font-semibold"
                >
                  <Edit2 size={16} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(setting.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 rounded py-2 hover:bg-red-500/20 transition text-sm font-semibold"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PayoutSettings;
