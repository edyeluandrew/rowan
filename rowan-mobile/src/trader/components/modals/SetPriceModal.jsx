import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import payoutSettingsAPI from '../../api/payoutSettings';
import client from '../../api/client';
import { FLOAT_UPDATE_CLOSE_MS, NETWORKS } from '../../utils/constants';

function networkLabel(network) {
  return NETWORKS[network]?.label || network;
}

function formatRate(value, currency) {
  const digits = String(currency || '').toUpperCase() === 'KES' ? 2 : 0;
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export default function SetPriceModal({ ads = [], initialId = null, onClose, onSuccess }) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(initialId || ads[0]?.id || null);
  const selected = ads.find((ad) => ad.id === selectedId) || null;
  const currency = selected?.currency || 'UGX';
  const [amount, setAmount] = useState(
    selected?.rate_per_usdc ? String(Number(selected.rate_per_usdc)) : ''
  );
  const [band, setBand] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!selected) return undefined;
    let cancelled = false;
    client.get('/api/v1/rates/current', { params: { currency: selected.currency } })
      .then((res) => {
        if (!cancelled) setBand(res.data?.p2pRateBand || null);
      })
      .catch(() => {
        if (!cancelled) setBand(null);
      });
    return () => { cancelled = true; };
  }, [selected]);

  const choose = (ad) => {
    setSelectedId(ad.id);
    setAmount(ad.rate_per_usdc ? String(Number(ad.rate_per_usdc)) : '');
    setSuccess(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    const rate = Number(amount);
    if (!Number.isFinite(rate) || rate <= 0) {
      setError('Enter how much fiat you want for 1 USDC');
      return;
    }
    if (band && (rate < band.minRate || rate > band.maxRate)) {
      setError(`Price must be between ${formatRate(band.minRate, currency)} and ${formatRate(band.maxRate, currency)} ${currency}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await payoutSettingsAPI.updatePayoutSetting(selected.id, { rate_per_usdc: rate });
      setSuccess(true);
      onSuccess?.();
      setTimeout(() => onClose(), FLOAT_UPDATE_CLOSE_MS);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save the price');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div className="bg-rowan-surface rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-6 sm:hidden" />
        <h3 className="text-rowan-text font-bold text-lg mb-1">USDC price</h3>
        <p className="text-rowan-muted text-xs mb-4">
          Fiat you charge or pay for 1 USDC. Customers see this on your ad.
        </p>

        {ads.length === 0 ? (
          <div className="space-y-3">
            <p className="text-rowan-muted text-sm">Add a cash-out ad before setting a price.</p>
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                navigate('/trader/payout-settings');
              }}
            >
              Open payout settings
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {ads.map((ad) => (
                <button
                  key={ad.id}
                  type="button"
                  className={`px-3 py-2 rounded-md text-sm font-medium border ${
                    ad.id === selected?.id
                      ? 'text-rowan-yellow border-rowan-yellow'
                      : 'text-rowan-muted border-rowan-border'
                  }`}
                  onClick={() => choose(ad)}
                >
                  {networkLabel(ad.network)} {ad.currency}
                </button>
              ))}
            </div>

            <p className="text-rowan-muted text-xs text-center mb-2">
              {currency} for 1 USDC
            </p>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setSuccess(false); }}
              placeholder={band ? formatRate(band.marketRate, currency) : '0'}
              className="bg-rowan-bg border border-rowan-border text-rowan-text text-2xl font-bold tabular-nums rounded-md p-4 w-full text-center focus:outline-none focus:border-rowan-yellow transition-colors"
            />
            <p className="text-rowan-muted text-[11px] text-center mt-2">
              {band
                ? `Market ${formatRate(band.marketRate, currency)} ${currency}. Allowed ${formatRate(band.minRate, currency)} to ${formatRate(band.maxRate, currency)}.`
                : 'Loading the market range.'}
            </p>

            {error && <p className="text-rowan-red text-sm mt-3 text-center">{error}</p>}
            {success && <p className="text-rowan-green text-sm mt-3 text-center">Price saved</p>}

            <div className="mt-4">
              <Button variant="primary" loading={saving} onClick={handleSave} disabled={!amount || !selected}>
                Save price
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
