import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import { confirmRequest } from '../../api/trader';
import { formatCurrency } from '../../utils/format';

export default function ConfirmPayoutModal({ open, request, onClose }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      await confirmRequest(request.id);
      setSuccess(true);
      setTimeout(() => navigate('/requests'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Confirmation failed');
      setConfirming(false);
    }
  };

  if (!open || !request) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onClose}>
      <div className="bg-rowan-surface rounded-t-2xl p-6 w-full" onClick={(e) => e.stopPropagation()}>
        <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-6" />

        {success ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 rounded-full bg-rowan-green flex items-center justify-center animate-scale-in mb-4">
              <Check size={32} className="text-white" strokeWidth={3} />
            </div>
            <h3 className="text-rowan-green text-xl font-bold">Payout Confirmed</h3>
            <p className="text-rowan-muted text-sm mt-2 text-center">
              USDC will be released to your wallet shortly.
            </p>
          </div>
        ) : (
          /* ── Confirm form ── */
          <>
            <h3 className="text-rowan-text font-bold text-lg">Confirm Payment Sent</h3>
            <p className="text-rowan-muted text-sm mt-3 mb-6">
              By confirming you are declaring that you have sent{' '}
              <span className="text-rowan-yellow font-bold">
                {formatCurrency(request.fiat_amount, request.fiat_currency)}
              </span>{' '}
              via {request.network} to the recipient. False confirmations result in account suspension.
            </p>

            {error && <p className="text-rowan-red text-sm mb-3">{error}</p>}

            <div className="flex flex-col gap-3">
              <Button variant="primary" size="lg" loading={confirming} onClick={handleConfirm}>
                Yes, I Sent the Money
              </Button>
              <Button variant="ghost" onClick={onClose} className="text-rowan-muted border-rowan-border">
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
