import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSessions, revokeSession, revokeAllSessions } from '../../api/security';
import { formatTimeAgo } from '../../utils/format';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

/**
 * Parse a user agent string into a readable device name.
 */
function parseDevice(ua) {
  if (!ua) return 'Unknown Device';
  if (/Chrome/.test(ua) && /Android/.test(ua)) return 'Chrome on Android';
  if (/Safari/.test(ua) && /iPhone|iPad/.test(ua)) return 'Safari on iOS';
  if (/Firefox/.test(ua)) return 'Firefox';
  if (/Chrome/.test(ua)) return 'Chrome on Desktop';
  if (/Safari/.test(ua)) return 'Safari on macOS';
  if (/Edge/.test(ua)) return 'Edge on Desktop';
  return 'Unknown Browser';
}

/**
 * ActiveSessions — view and revoke logged-in sessions.
 */
export default function ActiveSessions() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeAll, setShowRevokeAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSessions();
        setSessions(data.sessions || data || []);
      } catch { /* non-critical — empty list shown */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRevoke = async (sessionId) => {
    setRevoking(true);
    try {
      await revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch { /* revoke failed — session stays in list */ } finally {
      setRevoking(false);
      setConfirmId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevoking(true);
    try {
      await revokeAllSessions();
      await logout();
      navigate('/login', { replace: true });
    } catch { /* revoke-all failed — user stays on page */ } finally {
      setRevoking(false);
      setShowRevokeAll(false);
    }
  };

  return (
    <div className="bg-rowan-bg min-h-screen">
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
            {/* Current device banner */}
            <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-md p-3 mb-4 flex items-center gap-3">
              <Smartphone size={20} className="text-rowan-yellow" />
              <div>
                <p className="text-rowan-yellow font-bold text-sm">This device</p>
                <p className="text-rowan-muted text-xs">Currently active</p>
              </div>
            </div>

            {/* Session list */}
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-rowan-surface border border-rowan-border rounded-md p-4 mb-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-rowan-text text-sm font-medium flex-1">
                    {parseDevice(session.userAgent || session.user_agent)}
                  </span>
                  {session.isCurrent && (
                    <span className="bg-rowan-green/15 text-rowan-green text-xs px-2 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-rowan-muted text-xs font-mono">
                    {session.ipAddress || session.ip_address || session.ip || '—'}
                  </span>
                  <span className="text-rowan-muted text-xs">
                    {session.lastActive || session.last_active_at
                      ? formatTimeAgo(session.lastActive || session.last_active_at)
                      : '—'}
                  </span>
                  {!session.isCurrent && (
                    <button
                      onClick={() => setConfirmId(session.id)}
                      className="text-rowan-red text-xs font-medium ml-auto"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <p className="text-rowan-muted text-sm text-center py-10">No sessions found</p>
            )}

            {/* Revoke All Others */}
            {sessions.length >= 2 && (
              <button
                onClick={() => setShowRevokeAll(true)}
                className="w-full py-3 rounded-md border border-rowan-red text-rowan-red text-sm font-medium mt-4 active:bg-rowan-red/10 transition-colors"
              >
                Revoke All Others
              </button>
            )}
          </>
        )}
      </div>

      {/* Single session revoke confirmation */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setConfirmId(null)}>
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-rowan-text font-semibold text-base mb-2">Revoke Session?</h3>
            <p className="text-rowan-muted text-sm mb-6">
              Are you sure you want to revoke this session?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 py-3 rounded-xl bg-rowan-border text-rowan-text text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(confirmId)}
                disabled={revoking}
                className="flex-1 py-3 rounded-xl bg-rowan-red text-white text-sm font-medium disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke All confirmation */}
      {showRevokeAll && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowRevokeAll(false)}>
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-rowan-text font-semibold text-base mb-2">Revoke All Sessions?</h3>
            <p className="text-rowan-muted text-sm mb-6">
              This will log you out of all devices including this one.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRevokeAll(false)}
                className="flex-1 py-3 rounded-xl bg-rowan-border text-rowan-text text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeAll}
                disabled={revoking}
                className="flex-1 py-3 rounded-xl bg-rowan-red text-white text-sm font-medium disabled:opacity-50"
              >
                Revoke All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
