import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import payoutSettingsAPI from '../../api/payoutSettings';
import { formatCurrency } from '../../utils/format';
import { FLOAT_UPDATE_CLOSE_MS, NETWORKS } from '../../utils/constants';

function networkLabel(network) {
  return NETWORKS[network]?.label || network;
}

export default function FloatUpdateModal({ ads = [], initialId = null, onClose, onSuccess }) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(initialId || ads[0]?.id || null);
  const selected = ads.find((ad) => ad.id === selectedId) || null;
  const [amount, setAmount] = useState(
    selected ? String(Number(selected.available_float || 0)) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const reserved = Number(selected?.reserved_float || 0);
  const currency = selected?.currency || 'UGX';

  const choose = (ad) => {
    setSelectedId(ad.id);
    setAmount(String(Number(ad.available_float || 0)));
    setSuccess(false);
    setError(null);
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await payoutSettingsAPI.updatePayoutSetting(selected.id, {
        available_float: Number(amount),
      });
      setSuccess(true);
      onSuccess?.();
      setTimeout(() => onClose(), FLOAT_UPDATE_CLOSE_MS);
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div className="bg-rowan-surface rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-6 sm:hidden" />
        <h3 className="text-rowan-text font-bold text-lg mb-1">Update Float</h3>
        <p className="text-rowan-muted text-xs mb-4">
          This is the MoMo float matching uses. It is not a balance held by Rowan.
        </p>

        {ads.length === 0 ? (
          <div className="space-y-3">
            <p className="text-rowan-muted text-sm">Add a cash-out ad before setting float.</p>
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

            <div className="text-rowan-muted text-xs text-center mb-3">
              Available now: {formatCurrency(Number(selected?.available_float || 0) - reserved, currency)}
              {reserved > 0 ? ` · ${formatCurrency(reserved, currency)} reserved on open trades` : ''}
            </div>

            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setSuccess(false); }}
              placeholder="0"
              className="bg-rowan-bg border border-rowan-border text-rowan-text text-2xl font-bold tabular-nums rounded-md p-4 w-full text-center focus:outline-none focus:border-rowan-yellow transition-colors"
            />
            <p className="text-rowan-muted text-[11px] text-center mt-2">
              Type the total float, including money already reserved.
            </p>

            {error && <p className="text-rowan-red text-sm mt-3 text-center">{error}</p>}
            {success && <p className="text-rowan-green text-sm mt-3 text-center">Float updated</p>}

            <div className="mt-4">
              <Button variant="primary" loading={saving} onClick={handleUpdate} disabled={!amount || !selected}>
                Update Float
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
