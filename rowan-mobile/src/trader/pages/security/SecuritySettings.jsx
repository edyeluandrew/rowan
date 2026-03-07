import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Smartphone, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSessions, revokeAllSessions } from '../../api/security';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

/**
 * SecuritySettings — settings hub for security-related actions.
 */
export default function SecuritySettings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [sessionCount, setSessionCount] = useState(0);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSessions();
        const sessions = data.sessions || data || [];
        setSessionCount(Array.isArray(sessions) ? sessions.length : 0);
      } catch { /* non-critical — count defaults to 0 */ } finally {
        setLoadingSessions(false);
      }
    })();
  }, []);

  const handleRevokeAll = async () => {
    setRevoking(true);
    try {
      await revokeAllSessions();
      await logout();
      navigate('/', { replace: true });
    } catch { /* revoke failed — user stays on page */ } finally {
      setRevoking(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="bg-rowan-bg min-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-rowan-text font-semibold text-lg">Security</h1>
      </div>

      <div className="px-4 pt-4">
        {/* Change Password */}
        <button
          onClick={() => navigate('/trader/security/change-password')}
          className="w-full flex items-center gap-3 py-4 border-b border-rowan-border text-left"
        >
          <LockKeyhole size={20} className="text-rowan-yellow shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-rowan-text text-sm">Change Password</p>
            <p className="text-rowan-muted text-xs">Update your account password</p>
          </div>
          <ChevronRight size={16} className="text-rowan-muted" />
        </button>

        {/* Active Sessions */}
        <button
          onClick={() => navigate('/trader/security/sessions')}
          className="w-full flex items-center gap-3 py-4 border-b border-rowan-border text-left"
        >
          <Smartphone size={20} className="text-rowan-yellow shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-rowan-text text-sm">Active Sessions</p>
            <p className="text-rowan-muted text-xs">
              {loadingSessions ? (
                <LoadingSpinner size={12} className="text-rowan-muted inline" />
              ) : (
                `${sessionCount} active session${sessionCount !== 1 ? 's' : ''}`
              )}
            </p>
          </div>
          <ChevronRight size={16} className="text-rowan-muted" />
        </button>

        {/* 2FA - Coming Soon */}
        <div className="flex items-center gap-3 py-4 border-b border-rowan-border opacity-60">
          <ShieldCheck size={20} className="text-rowan-muted shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-rowan-text text-sm">Two-Factor Authentication</p>
          </div>
          <span className="bg-rowan-surface border border-rowan-border text-rowan-muted text-xs px-2 py-0.5 rounded">
            Coming Soon
          </span>
        </div>

        {/* Danger Zone */}
        <div className="mt-8">
          <p className="text-rowan-red text-xs uppercase tracking-wider mb-3">Danger Zone</p>
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full py-3 rounded-md border border-rowan-red text-rowan-red text-sm font-medium active:bg-rowan-red/10 transition-colors"
          >
            Revoke All Sessions
          </button>
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-rowan-text font-semibold text-base mb-2">Revoke All Sessions?</h3>
            <p className="text-rowan-muted text-sm mb-6">
              Are you sure? This will log you out of all devices.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-rowan-border text-rowan-text text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeAll}
                disabled={revoking}
                className="flex-1 py-3 rounded-xl bg-rowan-red text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {revoking && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                )}
                Revoke All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
