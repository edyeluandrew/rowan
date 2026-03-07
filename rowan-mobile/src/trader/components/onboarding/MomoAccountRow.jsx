import { useState } from 'react';
import { requestMomoOtp, verifyMomoOtp } from '../../api/onboarding';
import OtpInput from '../ui/OtpInput';

const NETWORK_OPTIONS = [
  { value: 'MTN_MOMO_UG', label: 'MTN MoMo UG' },
  { value: 'AIRTEL_UG', label: 'Airtel UG' },
  { value: 'MPESA_KE', label: 'M-Pesa KE' },
  { value: 'VODACOM_TZ', label: 'Vodacom TZ' },
  { value: 'TIGO_TZ', label: 'Tigo TZ' },
];

/**
 * MomoAccountRow — single mobile money account with OTP verification.
 * Props: index, onVerified(index, accountData), onRemove(index)
 */
export default function MomoAccountRow({ index, onVerified, onRemove }) {
  const [network, setNetwork] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verified, setVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [sendError, setSendError] = useState(null);

  const handleSendOtp = async () => {
    if (!network || !phoneNumber) return;
    setSendingOtp(true);
    setSendError(null);
    setSuccessMsg(null);
    try {
      await requestMomoOtp(network, phoneNumber);
      setOtpSent(true);
      setSuccessMsg('An OTP has been sent to your number');
    } catch (err) {
      setSendError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (code) => {
    setVerifyingOtp(true);
    setOtpError(null);
    try {
      await verifyMomoOtp(network, phoneNumber, code);
      setVerified(true);
      onVerified?.(index, { network, phoneNumber });
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div
      className={`bg-rowan-surface border rounded-md p-4 mb-3 ${
        verified
          ? 'border-l-4 border-l-rowan-green border-rowan-border'
          : 'border-rowan-border'
      }`}
    >
      {/* Row 1: Network + Remove */}
      <div className="flex items-center gap-2 mb-3">
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          disabled={verified}
          className="flex-1 bg-rowan-bg border border-rowan-border text-rowan-text rounded px-3 py-2.5 text-sm focus:outline-none focus:border-rowan-yellow disabled:opacity-50"
        >
          <option value="" className="text-rowan-muted">Select Network</option>
          {NETWORK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {!verified && (
          <button onClick={() => onRemove?.(index)} className="text-rowan-red text-xs font-medium shrink-0">
            Remove
          </button>
        )}

        {verified && (
          <span className="bg-rowan-green/15 text-rowan-green text-xs px-2 py-0.5 rounded font-medium shrink-0">
            ✓ Verified
          </span>
        )}
      </div>

      {/* Row 2: Phone number */}
      <input
        type="tel"
        placeholder="+256 700 000 000"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        disabled={verified}
        className="bg-rowan-bg border border-rowan-border text-rowan-text rounded px-4 py-3 w-full text-sm focus:outline-none focus:border-rowan-yellow disabled:opacity-50 mb-3"
      />

      {/* Row 3: OTP flow */}
      {!verified && !otpSent && (
        <button
          onClick={handleSendOtp}
          disabled={sendingOtp || !network || !phoneNumber}
          className="bg-rowan-yellow text-rowan-bg font-bold text-sm px-4 py-2.5 rounded w-full disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sendingOtp && (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          )}
          Send OTP
        </button>
      )}

      {sendError && <p className="text-rowan-red text-xs mt-2">{sendError}</p>}

      {otpSent && !verified && (
        <div className="mt-2">
          {successMsg && <p className="text-rowan-green text-xs mb-3">{successMsg}</p>}
          <OtpInput onComplete={handleVerifyOtp} disabled={verifyingOtp} error={!!otpError} />
          {verifyingOtp && (
            <p className="text-rowan-muted text-xs text-center mt-2">Verifying...</p>
          )}
          {otpError && <p className="text-rowan-red text-xs text-center mt-2">{otpError}</p>}
        </div>
      )}
    </div>
  );
}
