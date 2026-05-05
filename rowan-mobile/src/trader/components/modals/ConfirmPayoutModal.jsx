import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import { submitPayoutSent } from '../../api/trader';
import { formatCurrency } from '../../utils/format';

const PAYOUT_CONFIRM_REDIRECT_MS = 2000;

export default function ConfirmPayoutModal({ open, request, onClose }) {
  const navigate = useNavigate();
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!reference.trim()) {
      setError('Please enter a mobile money reference');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitPayoutSent(request.id, reference.trim());
      setSuccess(true);
      setTimeout(() => navigate('/trader/requests'), PAYOUT_CONFIRM_REDIRECT_MS);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Submission failed');
      setSubmitting(false);
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
            <h3 className="text-rowan-green text-xl font-bold">Payment Submitted</h3>
            <p className="text-rowan-muted text-sm mt-2 text-center">
              Waiting for customer confirmation before USDC is released to your wallet.
            </p>
          </div>
        ) : (
          /* ── Reference form ── */
          <>
            <h3 className="text-rowan-text font-bold text-lg">Confirm Payment Sent</h3>
            <p className="text-rowan-muted text-sm mt-3 mb-4">
              I have sent{' '}
              <span className="text-rowan-yellow font-bold">
                {formatCurrency(request.fiat_amount, request.fiat_currency)}
              </span>{' '}
              via {request.network} to the recipient.
            </p>

            <div className="mb-4">
              <label className="text-rowan-text text-xs font-medium block mb-2">
                Mobile Money Reference*
              </label>
              <input
                type="text"
                placeholder="Enter transaction reference (e.g., MTN123456789)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-rowan-text placeholder-rowan-muted text-sm focus:outline-none focus:border-rowan-yellow"
              />
              <p className="text-rowan-muted text-[10px] mt-1">
                This helps the customer verify the payment in their mobile money history
              </p>
            </div>

            {error && <p className="text-rowan-red text-sm mb-3">{error}</p>}

            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                loading={submitting}
                onClick={handleSubmit}
              >
                Submit Payment
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-rowan-muted border-rowan-border"
              >
                Cancel
              </Button>
            </div>

            <p className="text-rowan-muted text-[10px] mt-4 text-center">
              False declarations result in account suspension and fund forfeiture.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
