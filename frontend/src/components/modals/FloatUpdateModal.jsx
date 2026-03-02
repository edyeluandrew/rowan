import { useState } from 'react';
import Button from '../ui/Button';
import { updateFloat } from '../../api/trader';
import { formatCurrency } from '../../utils/format';

const CURRENCIES = ['UGX', 'KES', 'TZS'];

export default function FloatUpdateModal({ currentFloat = {}, onClose, onSuccess }) {
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateFloat(currency, Number(amount));
      setSuccess(true);
      onSuccess?.();
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onClose}>
      <div className="bg-rowan-surface rounded-t-2xl p-6 w-full" onClick={(e) => e.stopPropagation()}>
        <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-6" />
        <h3 className="text-rowan-text font-bold text-lg mb-4">Update Float</h3>

        {/* Currency tabs */}
        <div className="flex border-b border-rowan-border mb-4">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${
                currency === c
                  ? 'text-rowan-yellow border-b-2 border-rowan-yellow'
                  : 'text-rowan-muted'
              }`}
              onClick={() => { setCurrency(c); setAmount(''); setSuccess(false); setError(null); }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Current balance */}
        <div className="text-rowan-muted text-xs text-center mb-3">
          Current: {formatCurrency(currentFloat[currency] || 0, currency)}
        </div>

        {/* Amount input */}
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setSuccess(false); }}
          placeholder="0"
          className="bg-rowan-bg border border-rowan-border text-rowan-text text-2xl font-bold tabular-nums rounded-md p-4 w-full text-center focus:outline-none focus:border-rowan-yellow transition-colors"
        />

        {error && <p className="text-rowan-red text-sm mt-3 text-center">{error}</p>}
        {success && <p className="text-rowan-green text-sm mt-3 text-center">Float updated!</p>}

        <div className="mt-4">
          <Button variant="primary" loading={saving} onClick={handleUpdate} disabled={!amount}>
            Update Float
          </Button>
        </div>
      </div>
    </div>
  );
}
