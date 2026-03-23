import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { resetPassword, forgotPassword } from '../../api/security';
import OtpInput from '../../components/ui/OtpInput';
import Button from '../../components/ui/Button';

/**
 * ResetPassword — enter OTP code and new password.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const timerRef = useRef(null);

  // Redirect if no email
  useEffect(() => {
    if (!email) navigate('/forgot-password', { replace: true });
  }, [email, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      timerRef.current = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await forgotPassword(email);
      setResendCooldown(60);
    } catch {}
  };

  const hasLength = newPw.length >= 8;
  const hasUpper = /[A-Z]/.test(newPw);
  const hasNumber = /\d/.test(newPw);
  const hasSpecial = /[!@#$%^&*]/.test(newPw);
  const allMet = hasLength && hasUpper && hasNumber && hasSpecial;

  const getStrength = () => {
    if (newPw.length === 0) return { label: '', color: '', barColor: '', width: 'w-0' };
    if (!hasLength) return { label: 'Weak', color: 'text-rowan-red', barColor: 'bg-rowan-red', width: 'w-1/4' };
    if (!allMet) return { label: 'Fair', color: 'text-rowan-yellow', barColor: 'bg-rowan-yellow', width: 'w-1/2' };
    return { label: 'Strong', color: 'text-rowan-green', barColor: 'bg-rowan-green', width: 'w-full' };
  };

  const strength = getStrength();

  const handleSubmit = async () => {
    setError(null);
    if (code.length < 6) { setError('Enter the 6-digit code'); return; }
    if (!allMet) { setError('Password must meet all requirements'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await resetPassword(email, code, newPw, confirmPw);
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'bg-rowan-surface border border-rowan-border text-rowan-text rounded px-4 py-3.5 w-full focus:outline-none focus:border-rowan-yellow pr-14 text-sm';

  const Req = ({ met, label }) => (
    <div className="flex items-center gap-2">
      <span className={met ? 'text-rowan-green text-xs' : 'text-rowan-muted text-xs'}>{met ? '✓' : '✕'}</span>
      <span className={met ? 'text-rowan-green text-xs' : 'text-rowan-muted text-xs'}>{label}</span>
    </div>
  );

  if (success) {
    return (
      <div className="bg-rowan-bg min-h-screen flex flex-col items-center justify-center px-4">
        {/* Success animation */}
        <div className="w-20 h-20 rounded-full bg-rowan-green/10 flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 size={40} className="text-rowan-green" />
        </div>
        <h2 className="text-rowan-text font-semibold text-lg mb-2">Password Reset!</h2>
        <p className="text-rowan-muted text-sm text-center">
          Your password has been updated. Redirecting to sign in…
        </p>
      </div>
    );
  }

  return (
    <div className="bg-rowan-bg min-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate('/forgot-password')} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-rowan-text font-semibold text-lg">Reset Password</h1>
      </div>

      <div className="px-4 pt-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 56px)' }}>
        <p className="text-rowan-muted text-sm text-center mb-6">
          We sent a code to <span className="text-rowan-text font-medium">{email}</span>
        </p>

        {/* OTP code */}
        <label className="block mb-2 text-rowan-muted text-xs">Verification Code</label>
        <OtpInput onComplete={(c) => setCode(c)} error={!!error} />
        <div className="flex items-center justify-center mt-2 mb-6">
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="text-rowan-yellow text-xs disabled:text-rowan-muted"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>

        {/* New password */}
        <label className="block mb-1 text-rowan-muted text-xs">New Password</label>
        <div className="relative mb-2">
          <input
            type={showNew ? 'text' : 'password'}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className={inputCls}
            placeholder="Enter new password"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-rowan-muted text-xs"
          >
            {showNew ? 'Hide' : 'Show'}
          </button>
        </div>

        {/* Strength bar */}
        <div className="w-full h-1 rounded-full bg-rowan-border mb-1">
          <div className={`h-full rounded-full transition-all ${strength.barColor} ${strength.width}`} />
        </div>
        {strength.label && (
          <p className={`text-xs mb-3 ${strength.color}`}>{strength.label}</p>
        )}

        {/* Requirements */}
        <div className="space-y-1 mb-4">
          <Req met={hasLength} label="At least 8 characters" />
          <Req met={hasUpper} label="One uppercase letter" />
          <Req met={hasNumber} label="One number" />
          <Req met={hasSpecial} label="One special character (!@#$%^&*)" />
        </div>

        {/* Confirm password */}
        <label className="block mb-1 text-rowan-muted text-xs">Confirm Password</label>
        <div className="relative mb-4">
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            className={inputCls}
            placeholder="Confirm new password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-rowan-muted text-xs"
          >
            {showConfirm ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && <p className="text-rowan-red text-sm text-center mb-3">{error}</p>}

        <div className="mt-4 pb-8">
          <Button variant="primary" size="lg" onClick={handleSubmit} loading={loading}>
            Reset Password
          </Button>
        </div>
      </div>
    </div>
  );
}
