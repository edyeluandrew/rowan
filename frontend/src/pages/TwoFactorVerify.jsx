import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { verifyTwoFactorLogin } from '../../api/twoFactor';
import { useAuth } from '../../context/AuthContext';
import OtpInput from '../../components/ui/OtpInput';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

/**
 * TwoFactorVerify — Handle 2FA verification during login
 * Reached when login endpoint returns requiresTwoFactor: true
 */
export default function TwoFactorVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, setTrader } = useAuth();

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
      
      // Set auth context with token and trader info
      await setToken(data.token);
      await setTrader(data.trader);

      // Redirect to home
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-rowan-bg">
      {/* Header */}
      <button
        onClick={() => navigate('/login', { replace: true })}
        className="absolute top-4 left-4 text-rowan-muted p-2"
      >
        <ChevronLeft size={22} />
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
        <p className="text-rowan-muted text-sm text-center mb-6">
          Enter the 6-digit code from your authenticator app
        </p>

        <label className="block mb-4 text-rowan-muted text-xs">Verification Code</label>
        <OtpInput
          onComplete={(val) => setCode(val)}
          error={!!error}
          disabled={loading}
        />

        {error && (
          <p className="text-rowan-red text-sm text-center mt-4">{error}</p>
        )}

        <div className="mt-6">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
          >
            Verify
          </Button>
        </div>

        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="text-center text-rowan-muted text-xs mt-4 w-full"
        >
          Back to Sign In
        </button>
      </form>

      <p className="text-rowan-muted text-xs absolute bottom-6">2FA Required</p>
    </div>
  );
}
