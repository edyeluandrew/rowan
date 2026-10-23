import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Camera, Check, ImagePlus, X } from 'lucide-react';
import Button from '../ui/Button';
import { submitPayoutSent } from '../../api/trader';
import { formatCurrency } from '../../utils/format';
import useBiometrics from '../../../wallet/hooks/useBiometrics';

const PAYOUT_CONFIRM_REDIRECT_MS = 2000;

function fileFromBase64(base64, fileName, ext) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) bytes[i] = byteChars.charCodeAt(i);
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';
  return new File([bytes], fileName, { type });
}

export default function ConfirmPayoutModal({ open, request, onClose, onPayoutSubmitted }) {
  const navigate = useNavigate();
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const { authenticate, isAvailable, isEnabled } = useBiometrics();

  const clearProof = () => {
    setProofFile(null);
    if (proofPreview?.startsWith('blob:')) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
  };

  const takeProof = async (source) => {
    setError(null);
    try {
      const photo = await CapCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source,
      });
      const ext = photo.format === 'png' ? 'png' : 'jpeg';
      const fileName = `payment_${Date.now()}.${ext}`;
      clearProof();
      setProofFile(fileFromBase64(photo.base64String, fileName, ext));
      setProofPreview(`data:image/${ext};base64,${photo.base64String}`);
    } catch (err) {
      if (err?.message && !/cancel|dismiss/i.test(err.message)) {
        setError('Could not open the camera. Try again.');
      }
    }
  };

  const handleSubmit = async () => {
    if (!proofFile) {
      setError('Add a photo of the mobile money payment');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (isAvailable || isEnabled) {
        const verified = await authenticate('Confirm you sent the mobile money');
        if (!verified) {
          setError('Verification cancelled');
          setSubmitting(false);
          return;
        }
      }
      await submitPayoutSent(request.id, proofFile);
      if (onPayoutSubmitted) onPayoutSubmitted(request.id);
      setSuccess(true);
      setTimeout(() => navigate('/trader/requests'), PAYOUT_CONFIRM_REDIRECT_MS);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not send the photo');
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
            <div className="w-16 h-16 rounded-full bg-rowan-green flex items-center justify-center mb-4">
              <Check size={32} className="text-rowan-bg" strokeWidth={3} />
            </div>
            <h3 className="text-rowan-text text-xl font-bold">Payment photo sent</h3>
            <p className="text-rowan-muted text-sm mt-2 text-center">
              Waiting for the customer to confirm they received the mobile money. Then USDC is released to your wallet.
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-rowan-text font-bold text-lg">Confirm you sent mobile money</h3>
            <p className="text-rowan-muted text-sm mt-3 mb-4">
              Send exactly{' '}
              <span className="text-rowan-text font-bold">
                {formatCurrency(request.fiat_amount, request.fiat_currency)}
              </span>{' '}
              via {request.network}. Do not take a fee out of that amount. Add a photo of the receipt.
            </p>

            {proofPreview ? (
              <div className="relative mb-4">
                <img src={proofPreview} alt="Payment photo" className="rounded-xl max-h-44 w-full object-cover border border-rowan-border" />
                <button
                  type="button"
                  onClick={clearProof}
                  className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white"
                  aria-label="Remove photo"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => takeProof(CameraSource.Camera)}
                  className="border border-dashed border-rowan-border rounded-xl py-5 flex flex-col items-center gap-2 text-rowan-text"
                >
                  <Camera size={20} className="text-rowan-yellow" />
                  <span className="text-xs font-medium">Take photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => takeProof(CameraSource.Photos)}
                  className="border border-dashed border-rowan-border rounded-xl py-5 flex flex-col items-center gap-2 text-rowan-text"
                >
                  <ImagePlus size={20} className="text-rowan-yellow" />
                  <span className="text-xs font-medium">Upload screenshot</span>
                </button>
              </div>
            )}

            {error && <p className="text-rowan-red text-sm mb-3">{error}</p>}

            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                loading={submitting}
                disabled={!proofFile}
                onClick={handleSubmit}
              >
                I&apos;ve sent the mobile money
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
