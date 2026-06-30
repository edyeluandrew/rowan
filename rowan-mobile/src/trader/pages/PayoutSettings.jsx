/**
 * Trader Payout Settings — cash-out (fiat float) and sell-USDC (buy ads) settings.
 */

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import payoutSettingsAPI from '../api/payoutSettings';

const NETWORKS = ['MTN_UG', 'AIRTEL_UG', 'M_PESA_KE', 'MTN_TZ', 'AIRTEL_TZ'];
const CURRENCIES = ['UGX', 'KES', 'TZS'];
const COUNTRIES = { UG: 'Uganda', KE: 'Kenya', TZ: 'Tanzania' };

const AD_TABS = {
  sell: { ad_side: 'USER_SELL', label: 'Cash-out', floatLabel: 'MoMo float', floatKey: 'available_float', floatUnit: 'currency' },
  buy: { ad_side: 'USER_BUY', label: 'Sell USDC', floatLabel: 'USDC inventory', floatKey: 'available_usdc', floatUnit: 'USDC' },
};

function getEmptyFormData(adSide = 'USER_SELL') {
  return {
    ad_side: adSide,
    country: '',
    network: '',
    currency: '',
    min_amount: '',
    max_amount: '',
    available_float: '',
    available_usdc: '',
    rate_per_usdc: '',
    spread_percent: '',
    fee_percent: '',
  };
}

export default function PayoutSettings() {
  const [settings, setSettings] = useState([]);
  const [tab, setTab] = useState('sell');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(getEmptyFormData());
  const [submitting, setSubmitting] = useState(false);
  const [duplicateSetting, setDuplicateSetting] = useState(null);

  const tabConfig = AD_TABS[tab];
  const filteredSettings = settings.filter((s) => (s.ad_side || 'USER_SELL') === tabConfig.ad_side);

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
    setDuplicateSetting(null);
    setFormData(getEmptyFormData(tabConfig.ad_side));
    setShowForm(true);
  };

  const handleEditClick = (setting) => {
    setEditingId(setting.id);
    setFormData({
      ad_side: setting.ad_side || 'USER_SELL',
      country: setting.country,
      network: setting.network,
      currency: setting.currency,
      min_amount: setting.min_amount,
      max_amount: setting.max_amount,
      available_float: setting.available_float ?? '',
      available_usdc: setting.available_usdc ?? '',
      rate_per_usdc: setting.rate_per_usdc || '',
      spread_percent: setting.spread_percent || '',
      fee_percent: setting.fee_percent || '',
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setDuplicateSetting(null);
    setFormData(getEmptyFormData(tabConfig.ad_side));
  };

  const handleNetworkCurrencyChange = (newNetwork, newCurrency) => {
    const existing = settings.find(
      (s) => s.network === newNetwork
        && s.currency === newCurrency
        && (s.ad_side || 'USER_SELL') === tabConfig.ad_side
    );

    if (existing) {
      setDuplicateSetting(existing);
      setEditingId(existing.id);
      handleEditClick(existing);
    } else {
      setDuplicateSetting(null);
      setEditingId(null);
      setFormData((prev) => ({ ...prev, network: newNetwork, currency: newCurrency }));
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (submitting) return;

    const isBuyAd = tabConfig.ad_side === 'USER_BUY';
    const floatVal = isBuyAd ? formData.available_usdc : formData.available_float;

    if (!formData.country || !formData.network || !formData.currency
        || !formData.min_amount || !formData.max_amount || floatVal === '') {
      setError('Please fill in all required fields');
      return;
    }

    const min = parseFloat(formData.min_amount);
    const max = parseFloat(formData.max_amount);
    const floatNum = parseFloat(floatVal);

    if (max <= min) {
      setError('Max amount must be greater than min amount');
      return;
    }
    if (min < 0 || max < 0 || floatNum < 0) {
      setError('Amounts cannot be negative');
      return;
    }
    if (isBuyAd && floatNum <= 0) {
      setError('USDC inventory must be greater than 0');
      return;
    }

    const payload = {
      ad_side: tabConfig.ad_side,
      country: formData.country,
      network: formData.network,
      currency: formData.currency,
      min_amount: min,
      max_amount: max,
      available_float: isBuyAd ? 0 : floatNum,
      available_usdc: isBuyAd ? floatNum : 0,
      rate_per_usdc: formData.rate_per_usdc ? parseFloat(formData.rate_per_usdc) : null,
      spread_percent: formData.spread_percent ? parseFloat(formData.spread_percent) : null,
      fee_percent: formData.fee_percent ? parseFloat(formData.fee_percent) : null,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await payoutSettingsAPI.updatePayoutSetting(editingId, payload);
      } else {
        await payoutSettingsAPI.createPayoutSetting(payload);
      }
      await fetchSettings();
      handleCancel();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save payout setting');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this setting?')) return;
    try {
      await payoutSettingsAPI.deletePayoutSetting(id);
      await fetchSettings();
    } catch {
      setError('Failed to delete payout setting');
    }
  }

  async function handleToggle(id, currentStatus) {
    try {
      await payoutSettingsAPI.togglePayoutSettingStatus(id, !currentStatus);
      await fetchSettings();
    } catch {
      setError('Failed to toggle payout setting');
    }
  }

  const floatFieldValue = tabConfig.ad_side === 'USER_BUY'
    ? formData.available_usdc
    : formData.available_float;

  const setFloatField = (val) => {
    if (tabConfig.ad_side === 'USER_BUY') {
      setFormData((prev) => ({ ...prev, available_usdc: val }));
    } else {
      setFormData((prev) => ({ ...prev, available_float: val }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white pb-20">
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-yellow-900/30 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Trading Ads</h1>
          <button
            type="button"
            onClick={handleAddClick}
            className="bg-yellow-500 text-black rounded-lg p-2 hover:bg-yellow-400 transition"
          >
            <Plus size={24} />
          </button>
        </div>
        <p className="text-gray-400 text-sm mt-2">Cash-out liquidity and USDC sell ads for P2P buy</p>

        <div className="flex gap-2 mt-4">
          {Object.entries(AD_TABS).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTab(key); handleCancel(); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                tab === key ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-300'
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 bg-red-900/20 border border-red-600 rounded-lg p-4 flex gap-3">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
          <div className="text-red-200 text-sm">{error}</div>
        </div>
      )}

      {tab === 'buy' && !showForm && (
        <div className="mx-4 mt-4 bg-blue-900/20 border border-blue-700 rounded-lg p-3 text-sm text-blue-200">
          Sell USDC ads appear in the wallet Marketplace under Buy USDC. Customers pay you MoMo; you lock USDC in escrow per order.
        </div>
      )}

      {showForm && (
        <div className="mx-4 mt-4 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-2">
            {duplicateSetting ? 'Update' : 'Add'} {tabConfig.label} ad
          </h2>
          {duplicateSetting && (
            <div className="mb-4 p-3 bg-blue-900/30 border border-blue-600 rounded text-sm text-blue-200">
              You already have a {duplicateSetting.network}/{duplicateSetting.currency} {tabConfig.label} ad. Editing it now.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Country *</label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  disabled={!!editingId}
                >
                  <option value="">Select</option>
                  {Object.entries(COUNTRIES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Network *</label>
                <select
                  value={formData.network}
                  onChange={(e) => handleNetworkCurrencyChange(e.target.value, formData.currency)}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  disabled={!!duplicateSetting}
                >
                  <option value="">Select</option>
                  {NETWORKS.map((net) => (
                    <option key={net} value={net}>{net}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Currency *</label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleNetworkCurrencyChange(formData.network, e.target.value)}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  disabled={!!duplicateSetting}
                >
                  <option value="">Select</option>
                  {CURRENCIES.map((curr) => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Min order ({formData.currency || '?'}) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.min_amount}
                  onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Max order ({formData.currency || '?'}) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.max_amount}
                  onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">
                {tabConfig.floatLabel} *
              </label>
              <input
                type="number"
                step={tabConfig.ad_side === 'USER_BUY' ? '0.0000001' : '0.01'}
                value={floatFieldValue}
                onChange={(e) => setFloatField(e.target.value)}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                {tabConfig.ad_side === 'USER_BUY'
                  ? 'Total USDC you can sell across active buy orders'
                  : 'Mobile money liquidity for cash-out payouts'}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-yellow-500 text-black font-semibold rounded-lg py-2 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : (duplicateSetting ? 'Update' : 'Create')}
              </button>
              <button type="button" onClick={handleCancel} className="flex-1 bg-gray-700 rounded-lg py-2">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : filteredSettings.length === 0 ? (
          <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
            <p className="text-gray-400 mb-3">No {tabConfig.label.toLowerCase()} ads yet</p>
            <button
              type="button"
              onClick={handleAddClick}
              className="inline-flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-lg font-semibold"
            >
              <Plus size={18} /> Add {tabConfig.label} ad
            </button>
          </div>
        ) : (
          filteredSettings.map((setting) => {
            const isBuy = (setting.ad_side || 'USER_SELL') === 'USER_BUY';
            const netFloat = isBuy
              ? parseFloat(setting.available_usdc || 0) - parseFloat(setting.reserved_usdc || 0)
              : parseFloat(setting.available_float || 0) - parseFloat(setting.reserved_float || 0);
            return (
              <div key={setting.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{setting.network} ({setting.currency})</h3>
                    <p className="text-sm text-gray-400">{COUNTRIES[setting.country] || setting.country}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(setting.id, setting.is_active)}
                    className={`px-3 py-1 rounded text-xs font-semibold ${
                      setting.is_active ? 'bg-green-900/40 text-green-200' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {setting.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400">Min</p>
                    <p className="font-mono text-yellow-400">{Number(setting.min_amount).toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400">Max</p>
                    <p className="font-mono text-yellow-400">{Number(setting.max_amount).toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-gray-400">{isBuy ? 'USDC free' : 'Float'}</p>
                    <p className="font-mono text-blue-400">
                      {isBuy ? netFloat.toFixed(2) : netFloat.toFixed(0)} {isBuy ? 'USDC' : setting.currency}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setTab(isBuy ? 'buy' : 'sell'); handleEditClick(setting); }}
                    className="flex-1 flex items-center justify-center gap-2 bg-yellow-500/10 text-yellow-400 rounded py-2 text-sm"
                  >
                    <Edit2 size={16} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(setting.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 rounded py-2 text-sm"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
