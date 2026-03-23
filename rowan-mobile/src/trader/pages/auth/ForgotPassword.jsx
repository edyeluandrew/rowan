import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail } from 'lucide-react';
import { forgotPassword } from '../../api/security';
import Button from '../../components/ui/Button';

/**
 * ForgotPassword — public route, enter email to receive a reset code.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) { setError('Email is required'); return; }

    setLoading(true);
    try {
      await forgotPassword(trimmed);
      setSent(true);
      setTimeout(() => {
        navigate('/trader/reset-password', { state: { email: trimmed } });
      }, 2500);
    } catch (err) {
      // Always show neutral message for security
      setSent(true);
      setTimeout(() => {
        navigate('/trader/reset-password', { state: { email: trimmed } });
      }, 2500);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'bg-rowan-surface border border-rowan-border text-rowan-text rounded px-4 py-3.5 w-full focus:outline-none focus:border-rowan-yellow text-sm';

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate('/')} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-rowan-text font-semibold text-lg">Forgot Password</h1>
      </div>

      <div className="flex-1 flex flex-col px-4 pt-10">
        {/* Icon */}
        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-rowan-yellow/10 flex items-center justify-center">
          <Mail size={32} className="text-rowan-yellow" />
        </div>

        <h2 className="text-rowan-text text-center font-semibold text-lg mb-2">Reset your password</h2>
        <p className="text-rowan-muted text-center text-sm mb-8">
          Enter the email linked to your account and we'll send you a reset code.
        </p>

        {sent ? (
          <div className="bg-rowan-green/15 border border-rowan-green/30 rounded-md p-4 text-center">
            <p className="text-rowan-green text-sm font-medium mb-1">Check your email</p>
            <p className="text-rowan-muted text-xs">
              If an account exists for {email}, we sent a password reset code. Redirecting…
            </p>
          </div>
        ) : (
          <>
            <label className="block mb-1 text-rowan-muted text-xs">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="you@example.com"
              autoComplete="email"
            />

            {error && <p className="text-rowan-red text-sm text-center mt-2">{error}</p>}

            <div className="mt-6">
              <Button variant="primary" size="lg" onClick={handleSubmit} loading={loading}>
                Send Reset Code
              </Button>
            </div>

            <button
              onClick={() => navigate('/')}
              className="text-rowan-muted text-sm text-center mt-4"
            >
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
