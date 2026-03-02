import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { changePassword } from '../../api/security';
import Button from '../../components/ui/Button';

/**
 * ChangePassword — change current password with strength indicator.
 */
export default function ChangePassword() {
  const navigate = useNavigate();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const hasLength = newPw.length >= 8;
  const hasUpper = /[A-Z]/.test(newPw);
  const hasNumber = /\d/.test(newPw);
  const hasSpecial = /[!@#$%^&*]/.test(newPw);
  const allMet = hasLength && hasUpper && hasNumber && hasSpecial;

  const getStrength = () => {
    if (newPw.length === 0) return { label: '', color: '', width: 'w-0' };
    if (!hasLength) return { label: 'Weak', color: 'text-rowan-red', barColor: 'bg-rowan-red', width: 'w-1/4' };
    if (!allMet) return { label: 'Fair', color: 'text-rowan-yellow', barColor: 'bg-rowan-yellow', width: 'w-1/2' };
    return { label: 'Strong', color: 'text-rowan-green', barColor: 'bg-rowan-green', width: 'w-full' };
  };

  const strength = getStrength();

  const handleSubmit = async () => {
    setError(null);
    if (!currentPw) { setError('Current password is required'); return; }
    if (!allMet) { setError('New password must meet all requirements'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await changePassword(currentPw, newPw, confirmPw);
      setSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => navigate(-1), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
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

  return (
    <div className="bg-rowan-bg min-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-rowan-text font-semibold text-lg">Change Password</h1>
      </div>

      <div className="px-4 pt-6">
        {success && (
          <div className="bg-rowan-green/15 border border-rowan-green/30 rounded-md p-3 mb-4">
            <p className="text-rowan-green text-sm font-medium">Password changed successfully!</p>
          </div>
        )}

        {/* Current password */}
        <label className="block mb-1 text-rowan-muted text-xs">Current Password</label>
        <div className="relative mb-4">
          <input
            type={showCurrent ? 'text' : 'password'}
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            className={inputCls}
            placeholder="Enter current password"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-rowan-muted text-xs"
          >
            {showCurrent ? 'Hide' : 'Show'}
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
          <div className={`h-full rounded-full transition-all ${strength.barColor || ''} ${strength.width}`} />
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
        <label className="block mb-1 text-rowan-muted text-xs">Confirm New Password</label>
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

        <div className="mt-6">
          <Button variant="primary" size="lg" onClick={handleSubmit} loading={loading}>
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}
