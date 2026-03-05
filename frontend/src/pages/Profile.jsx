import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, Timer, BarChart3, TrendingUp, Settings,
  ChevronRight, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getProfile } from '../api/trader';
import { formatCurrency, formatAddress } from '../utils/format';
import { getPreference, setPreference } from '../utils/storage';
import TrustScore from '../components/ui/TrustScore';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function Profile() {
  const { trader, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [showLogout, setShowLogout] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const resp = await getProfile();
        setProfile(resp.trader || resp);
      } catch { setError('Failed to load profile'); } finally {
        setLoading(false);
      }
    })();
    // Load preferences
    (async () => {
      const s = await getPreference('sound_enabled');
      const v = await getPreference('vibration_enabled');
      if (s !== null) setSoundEnabled(s === 'true');
      if (v !== null) setVibrationEnabled(v === 'true');
    })();
  }, []);

  const toggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    await setPreference('sound_enabled', String(next));
  };

  const toggleVibration = async () => {
    const next = !vibrationEnabled;
    setVibrationEnabled(next);
    await setPreference('vibration_enabled', String(next));
  };

  const copyAddress = () => {
    const addr = profile?.stellar_address || trader?.stellar_address;
    if (!addr) return;
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS);
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const p = profile || trader || {};

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={28} className="text-rowan-yellow" />
      </div>
    );
  }

  return (
    <div className="bg-rowan-bg min-h-screen px-4 pt-4 pb-28">
      <h1 className="text-rowan-text font-semibold text-lg mb-5">Profile</h1>

      {error && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mb-4 text-rowan-red text-sm">{error}</div>
      )}

      {/* Identity Card */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-rowan-yellow/20 flex items-center justify-center text-rowan-yellow text-lg font-bold">
            {(p.name || p.email || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-rowan-text font-semibold text-sm truncate">{p.name || p.email}</p>
            <p className="text-rowan-muted text-xs truncate">{p.email}</p>
          </div>
        </div>
        {p.region && (
          <div className="flex justify-between text-xs">
            <span className="text-rowan-muted">Region</span>
            <span className="text-rowan-text">{p.region}</span>
          </div>
        )}
        {p.verification_status && (
          <div className="flex justify-between text-xs mt-1">
            <span className="text-rowan-muted">Verification</span>
            <span
              className={
                p.verification_status === 'verified'
                  ? 'text-rowan-green'
                  : 'text-rowan-yellow'
              }
            >
              {p.verification_status}
            </span>
          </div>
        )}
      </div>

      {/* Trust Score */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <h3 className="text-rowan-muted text-xs uppercase tracking-wider mb-3">Trust Score</h3>
        <TrustScore score={p.trust_score ?? 0} />
      </div>

      {/* Stellar Wallet */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <h3 className="text-rowan-muted text-xs uppercase tracking-wider mb-2">Stellar Wallet</h3>
        <div className="flex items-center gap-2">
          <span className="text-rowan-text text-xs font-mono flex-1 truncate">
            {formatAddress(p.stellar_address || '')}
          </span>
          <button
            onClick={copyAddress}
            className="text-rowan-yellow text-xs font-medium shrink-0"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Float Balances */}
      {p.float_balances && (
        <div className="bg-rowan-surface rounded-xl p-4 mb-4">
          <h3 className="text-rowan-muted text-xs uppercase tracking-wider mb-3">Float Balances</h3>
          <div className="space-y-2">
            {Object.entries(p.float_balances).map(([currency, amount]) => (
              <div key={currency} className="flex justify-between">
                <span className="text-rowan-muted text-sm">{currency}</span>
                <span className="text-rowan-text text-sm font-semibold">
                  {formatCurrency(amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <div className="bg-rowan-surface rounded-xl mb-4 divide-y divide-rowan-border">
        {[
          { to: '/wallet', icon: Globe, label: 'Stellar Wallet', sub: 'Balance & receipts' },
          { to: '/sla', icon: Timer, label: 'SLA Performance', sub: 'Payout targets' },
          { to: '/performance/networks', icon: BarChart3, label: 'Network Performance', sub: 'Stats by network' },
          { to: '/earnings', icon: TrendingUp, label: 'Earnings', sub: 'Breakdown & history' },
        ].map(({ to, icon: Icon, label, sub }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-rowan-surface/80 transition-colors"
          >
            <Icon size={18} className="text-rowan-yellow shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-rowan-text text-sm font-medium">{label}</p>
              <p className="text-rowan-muted text-xs">{sub}</p>
            </div>
            <ChevronRight size={16} className="text-rowan-muted shrink-0" />
          </button>
        ))}
      </div>

      {/* Security */}
      <button
        onClick={() => navigate('/security')}
        className="bg-rowan-surface rounded-xl p-4 mb-4 w-full flex items-center gap-3 text-left active:bg-rowan-surface/80 transition-colors"
      >
        <Settings size={18} className="text-rowan-yellow shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-rowan-text text-sm font-medium">Security</p>
          <p className="text-rowan-muted text-xs">Password, sessions &amp; 2FA</p>
        </div>
        <ChevronRight size={16} className="text-rowan-muted shrink-0" />
      </button>

      {/* Preferences */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <h3 className="text-rowan-muted text-xs uppercase tracking-wider mb-3">Preferences</h3>

        <div className="flex justify-between items-center py-2">
          <span className="text-rowan-text text-sm">Sound Notifications</span>
          <button
            onClick={toggleSound}
            className={`w-11 h-6 rounded-full relative transition-colors ${
              soundEnabled ? 'bg-rowan-yellow' : 'bg-rowan-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="flex justify-between items-center py-2">
          <span className="text-rowan-text text-sm">Vibration</span>
          <button
            onClick={toggleVibration}
            className={`w-11 h-6 rounded-full relative transition-colors ${
              vibrationEnabled ? 'bg-rowan-yellow' : 'bg-rowan-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                vibrationEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* App Version */}
      <p className="text-center text-rowan-muted text-[10px] mb-3">
        v{import.meta.env.VITE_APP_VERSION || '1.0.0'} MVP
      </p>

      {/* Logout */}
      <button
        onClick={() => setShowLogout(true)}
        className="w-full py-3 text-rowan-red text-sm font-medium rounded-xl bg-rowan-surface active:bg-rowan-red/10 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut size={16} /> Log Out
      </button>

      {/* Logout Confirmation */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowLogout(false)}>
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6 animate-slide-down"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-rowan-text font-semibold text-base mb-2">Log Out?</h3>
            <p className="text-rowan-muted text-sm mb-6">
              You'll need to sign in again to access your trader dashboard.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogout(false)}
                className="flex-1 py-3 rounded-xl bg-rowan-border text-rowan-text text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-xl bg-rowan-red text-white text-sm font-medium"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
