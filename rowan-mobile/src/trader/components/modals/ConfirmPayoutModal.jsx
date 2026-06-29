import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ImagePlus, X } from 'lucide-react';
import Button from '../ui/Button';
import { submitPayoutSent } from '../../api/trader';
import { formatCurrency } from '../../utils/format';

const PAYOUT_CONFIRM_REDIRECT_MS = 2000;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

export default function ConfirmPayoutModal({ open, request, onClose, onPayoutSubmitted }) {
  const navigate = useNavigate();
  const [reference, setReference] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a JPEG or PNG image');
      return;
    }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setError(null);
    e.target.value = '';
  };

  const clearProof = () => {
    setProofFile(null);
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
  };

  const handleSubmit = async () => {
    if (!reference.trim()) {
      setError('Please enter a mobile money reference');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitPayoutSent(request.id, reference.trim(), proofFile);
      if (onPayoutSubmitted) {
        onPayoutSubmitted(request.id);
      }
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
      <div className="bg-rowan-surface rounded-t-2xl p-6 w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-6" />

        {success ? (
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 rounded-full bg-rowan-green flex items-center justify-center animate-scale-in mb-4">
              <Check size={32} className="text-white" strokeWidth={3} />
            </div>
            <h3 className="text-rowan-green text-xl font-bold">Payment Proof Submitted</h3>
            <p className="text-rowan-muted text-sm mt-2 text-center">
              Payment proof submitted. Waiting for user confirmation.
            </p>
          </div>
        ) : (
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
            </div>

            <div className="mb-4">
              <label className="text-rowan-text text-xs font-medium block mb-2">
                Upload payment screenshot
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleFileSelect}
              />
              {proofPreview ? (
                <div className="relative">
                  <img src={proofPreview} alt="Payment proof preview" className="rounded-lg max-h-40 w-full object-cover border border-rowan-border" />
                  <button
                    type="button"
                    onClick={clearProof}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white"
                    aria-label="Remove image"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border border-dashed border-rowan-yellow/50 rounded-xl py-6 flex flex-col items-center gap-2 text-rowan-yellow"
                >
                  <ImagePlus size={24} />
                  <span className="text-xs font-medium">Upload payment screenshot</span>
                  <span className="text-rowan-muted text-[10px]">JPEG or PNG</span>
                </button>
              )}
            </div>

            {error && <p className="text-rowan-red text-sm mb-3">{error}</p>}

            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                loading={submitting}
                disabled={!reference.trim()}
                onClick={handleSubmit}
              >
                I have sent payment
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-rowan-muted border-rowan-border"
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
