import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { verifyTwoFactorLogin } from '../../api/twoFactor';
import { useAuth } from '../../../context/AuthContext';
import OtpInput from '../../components/ui/OtpInput';

/**
 * TwoFactorVerify — Handle 2FA verification during trader login
 * Reached when login endpoint returns requiresTwoFactor: true
 */
export default function TwoFactorVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setTraderAuthAfter2FA } = useAuth();

  const traderId = location.state?.traderId;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if traderId not provided
  if (!traderId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-rowan-bg">
        <h1 className="text-rowan-yellow text-3xl font-bold tracking-widest mb-4">ROWAN</h1>
        <p className="text-rowan-red text-sm">Session expired. Please sign in again.</p>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="mt-6 text-rowan-yellow underline text-sm"
        >
          Back to Login
        </button>
      </div>
    );
  }

  const handleVerify = async () => {
    if (code.length < 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await verifyTwoFactorLogin(traderId, code);

      // Set auth context with token and trader info from 2FA verification response
      setTraderAuthAfter2FA(data.token, data.trader);

      // Redirect to trader home
      navigate('/trader/home', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-rowan-bg">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 text-rowan-muted p-2 min-h-10 min-w-10 flex items-center justify-center"
      >
        <ChevronLeft size={24} />
      </button>

      {/* Logo */}
      <h1 className="text-rowan-yellow text-4xl font-bold tracking-widest">ROWAN</h1>
      <p className="text-rowan-muted text-sm mt-2">Authentication Code</p>

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify();
        }}
        className="mt-12 w-full max-w-sm"
      >
        <p className="text-rowan-muted text-sm text-center mb-8 leading-relaxed">
          Enter the 6-digit code from your authenticator app
        </p>

        <div className="mb-6">
          <OtpInput
            onComplete={(val) => setCode(val)}
            error={!!error}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red text-sm rounded-lg px-4 py-3 mb-6 text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="w-full py-4 rounded-xl bg-rowan-yellow text-rowan-bg font-bold text-base transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 min-h-12"
        >
          {loading && (
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          )}
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={handleBack}
          className="text-center text-rowan-muted text-xs mt-6 w-full hover:text-rowan-yellow transition-colors min-h-9"
        >
          Back to Sign In
        </button>
      </form>

      <p className="text-rowan-muted text-xs absolute bottom-6">Trader 2FA Required</p>
    </div>
  );
}
