import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { useSessions } from '../../hooks/useSessions';
import SessionCard from '../../components/sessions/SessionCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

/**
 * ActiveSessions — view and revoke logged-in sessions.
 * Allows traders to manage devices and secure their accounts.
 */
export default function ActiveSessions() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { success: successToast, error: errorToast } = useToast();
  const { sessions, loading, error, revoking, revoke, revokeAll } = useSessions();
  const [confirmId, setConfirmId] = useState(null);
  const [revokeAllId, setRevokeAllId] = useState(null);

  const handleRevoke = async (sessionId) => {
    const success = await revoke(sessionId);
    if (success) {
      successToast('Session Revoked', 'Device has been signed out');
    } else {
      errorToast('Failed to Revoke', 'Could not revoke this session');
    }
    setConfirmId(null);
  };

  const handleRevokeAll = async () => {
    const success = await revokeAll();
    if (success) {
      successToast('Logging Out', 'Signing out from all devices...');
      setTimeout(() => {
        logout();
        navigate('/login', { replace: true });
      }, 1500);
    } else {
      errorToast('Failed to Logout', 'Could not revoke all sessions');
    }
    setRevokeAllId(null);
  };

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-rowan-text font-semibold text-lg">Active Sessions</h1>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size={28} className="text-rowan-yellow" />
          </div>
        ) : (
          <>
            {/* Page description */}
            <p className="text-rowan-muted text-sm mb-6">
              Manage devices currently signed into your Rowan account.
            </p>

            {/* Current device banner */}
            <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-lg p-4 mb-6 flex items-center gap-3">
              <Smartphone size={20} className="text-rowan-yellow flex-shrink-0" />
              <div className="flex-1">
                <p className="text-rowan-yellow font-bold text-sm">This device</p>
                <p className="text-rowan-muted text-xs">Currently active</p>
              </div>
            </div>

            {/* Session list */}
            {sessions && sessions.length > 0 ? (
              <>
                <div className="mb-4">
                  <p className="text-rowan-muted text-xs uppercase tracking-wider mb-3">
                    Active Sessions ({sessions.length})
                  </p>
                  {sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isCurrent={session.isCurrent}
                      onRevoke={() => setConfirmId(session.id)}
                      loading={revoking}
                    />
                  ))}
                </div>

                {/* Revoke All Others button */}
                {sessions.filter((s) => !s.isCurrent).length > 0 && (
                  <button
                    onClick={() => setRevokeAllId(true)}
                    disabled={revoking}
                    className="w-full py-3 rounded-lg border border-rowan-red/50 text-rowan-red text-sm font-medium hover:bg-rowan-red/5 active:bg-rowan-red/10 transition-colors disabled:opacity-50"
                  >
                    Revoke All Other Sessions
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <Smartphone size={48} className="text-rowan-muted mb-4 opacity-30" />
                <p className="text-rowan-muted text-sm text-center">
                  No active sessions found
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Single session revoke confirmation modal */}
      {confirmId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setConfirmId(null)}
        >
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-3xl p-6 border-t border-rowan-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-rowan-text font-semibold text-base mb-2">
              Revoke Session?
            </h3>
            <p className="text-rowan-muted text-sm mb-6">
              You will be signed out of this device. You can sign back in anytime.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                disabled={revoking}
                className="flex-1 py-3 rounded-lg bg-rowan-border text-rowan-text text-sm font-medium active:bg-rowan-border/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(confirmId)}
                disabled={revoking}
                className="flex-1 py-3 rounded-lg bg-rowan-red text-white text-sm font-medium active:bg-rowan-red/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {revoking && <LoadingSpinner size={16} />}
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke All confirmation modal */}
      {revokeAllId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setRevokeAllId(null)}
        >
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-3xl p-6 border-t border-rowan-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-rowan-text font-semibold text-base mb-2">
              Revoke All Other Sessions?
            </h3>
            <p className="text-rowan-muted text-sm mb-6">
              This will sign you out of all devices except this one. You'll stay signed in here.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRevokeAllId(null)}
                disabled={revoking}
                className="flex-1 py-3 rounded-lg bg-rowan-border text-rowan-text text-sm font-medium active:bg-rowan-border/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeAll}
                disabled={revoking}
                className="flex-1 py-3 rounded-lg bg-rowan-red text-white text-sm font-medium active:bg-rowan-red/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {revoking && <LoadingSpinner size={16} />}
                Revoke All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
