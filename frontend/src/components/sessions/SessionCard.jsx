import { Smartphone, LogOut } from 'lucide-react';
import { formatTimeAgo } from '../../utils/format';

/**
 * Parse user agent string into readable device name.
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
 * SessionCard — display individual session metadata with revoke action.
 */
export default function SessionCard({
  session,
  isCurrent = false,
  onRevoke = () => {},
  loading = false,
}) {
  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-lg p-4 mb-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <Smartphone size={18} className="text-rowan-yellow flex-shrink-0" />
          <div>
            <p className="text-rowan-text font-semibold text-sm">
              {parseDevice(session.userAgent || session.user_agent)}
            </p>
            {session.location || session.country ? (
              <p className="text-rowan-muted text-xs">
                {session.location || session.country}
              </p>
            ) : null}
          </div>
        </div>
        {isCurrent && (
          <span className="bg-rowan-green/15 text-rowan-green text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0">
            This device
          </span>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-2 mb-3">
        {/* IP Address */}
        <div className="flex items-center justify-between">
          <span className="text-rowan-muted text-xs">IP Address</span>
          <span className="text-rowan-text font-mono text-xs">
            {session.ipAddress || session.ip_address || session.ip || '—'}
          </span>
        </div>

        {/* Last Active */}
        {(session.lastActive || session.last_active_at) && (
          <div className="flex items-center justify-between">
            <span className="text-rowan-muted text-xs">Last active</span>
            <span className="text-rowan-text text-xs">
              {formatTimeAgo(session.lastActive || session.last_active_at)}
            </span>
          </div>
        )}

        {/* Created At / Login Time */}
        {(session.createdAt || session.created_at) && (
          <div className="flex items-center justify-between">
            <span className="text-rowan-muted text-xs">Signed in</span>
            <span className="text-rowan-text text-xs">
              {new Date(session.createdAt || session.created_at).toLocaleDateString(
                'en-US',
                { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
              )}
            </span>
          </div>
        )}
      </div>

      {/* Action */}
      {!isCurrent && (
        <button
          onClick={onRevoke}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-rowan-red/30 text-rowan-red text-xs font-medium hover:bg-rowan-red/5 active:bg-rowan-red/10 transition-colors disabled:opacity-50"
        >
          <LogOut size={14} />
          Revoke Session
        </button>
      )}
    </div>
  );
}
