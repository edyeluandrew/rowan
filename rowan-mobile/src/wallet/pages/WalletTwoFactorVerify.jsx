/**
 * WalletTwoFactorVerify — Full-screen 2FA verification for wallet users
 * Alternative to modal approach — can be routed directly if needed
 * Currently unused in favor of modal in Register.jsx, kept for future use
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { verifyTwoFactorLogin } from '../api/twoFactor';
import { useAuth } from '../context/AuthContext';
import { getSecure } from '../../shared/utils/storage';
import OtpVerificationCard from '../../shared/components/twofactor/OtpVerificationCard';

export default function WalletTwoFactorVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setWalletAuthAfter2FA } = useAuth();

  const userId = location.state?.userId;
  const token = location.state?.token;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if userId or token not provided
  if (!userId || !token) {
    return (
      <div className="bg-rowan-bg min-h-screen flex flex-col items-center justify-center px-6">
        <h1 className="text-rowan-yellow text-3xl font-bold tracking-widest mb-4">ROWAN</h1>
        <p className="text-rowan-red text-sm">Session expired. Please sign in again.</p>
        <button
          onClick={() => navigate('/register', { replace: true })}
          className="mt-6 text-rowan-yellow underline text-sm min-h-11"
        >
          Back to Login
        </button>
      </div>
    );
  }

  const handleVerify = async (verifyCode) => {
    setLoading(true);
    setError(null);
    try {
      // Verify 2FA code
      const response = await verifyTwoFactorLogin(userId, verifyCode);

      if (response?.verified === true) {
        // Get keypair from secure storage
        let keypair = null;
        try {
          const kpJSON = await getSecure('rowan_stellar_keypair');
          if (kpJSON) {
            keypair = JSON.parse(kpJSON);
          }
        } catch (err) {
          console.warn('[2FA] Could not retrieve keypair:', err.message);
        }

        // Complete wallet auth with token issued before 2FA
        await setWalletAuthAfter2FA(token, { id: userId }, keypair);

        // Redirect to wallet home
        navigate('/wallet/home', { replace: true });
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/register', { replace: true });
  };

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col px-6 pt-6">
      {/* Back button */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={handleBack}
          className="text-rowan-text p-2 min-h-10 min-w-10 flex items-center justify-center"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text font-semibold text-lg flex-1">Verify Your Identity</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center">
        <OtpVerificationCard
          onSubmit={handleVerify}
          loading={loading}
          error={error}
          title="Enter Your Authentication Code"
          description="Enter the 6-digit code from your authenticator app or use a backup code to verify your identity."
          submitText="Verify & Continue"
          supportBackupCodes={true}
        />

        {/* Info Note */}
        <p className="text-rowan-muted text-xs mt-6 text-center">
          Don't have your authenticator app? Use a backup code instead.
        </p>
      </div>

      {/* Footer */}
      <div className="pb-6 text-center">
        <button
          onClick={handleBack}
          className="text-rowan-yellow text-sm underline min-h-11"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
