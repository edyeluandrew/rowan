/**
 * Trader sign-in used by the phone app and the website.
 * Same form on both: email, password, 2FA handoff, signup, forgot password.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginTrader as apiLoginTrader } from '../api/auth';
import RowanLogo from '../../components/RowanLogo';

export default function TraderLoginForm({ onBack }) {
  const { loginAsTrader } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTraderLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiLoginTrader(email, password);

      if (response.requiresTwoFactor) {
        navigate('/trader/2fa-verify', {
          replace: true,
          state: { traderId: response.traderId },
        });
      } else {
        await loginAsTrader(email, password);
        navigate('/trader/home', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 bg-rowan-bg safe-top safe-bottom">
      <RowanLogo size={40} />
      <p className="text-rowan-muted text-sm mt-2">OTC Trader Portal</p>

      <form onSubmit={handleTraderLogin} className="mt-12 w-full max-w-sm">
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-4 py-3.5 w-full text-base focus:outline-none focus:border-rowan-green transition-colors mb-3 placeholder-rowan-muted min-h-11"
        />
        <div className="relative mb-4">
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-4 py-3.5 w-full text-base focus:outline-none focus:border-rowan-green transition-colors pr-14 placeholder-rowan-muted min-h-11"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-rowan-muted text-xs select-none min-h-9"
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 font-bold rounded-xl py-4 w-full text-base bg-rowan-green text-white transition-opacity disabled:opacity-50 min-h-11"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        {error && <p className="text-rowan-red text-sm mt-3 text-center">{error}</p>}

        <button
          type="button"
          onClick={() => navigate('/trader/forgot-password')}
          className="block w-full text-center text-rowan-muted text-xs mt-3 min-h-9"
        >
          Forgot Password?
        </button>
      </form>

      <p className="text-rowan-muted text-sm mt-6">
        {"Don't have a trader account? "}
        <button onClick={() => navigate('/trader/signup')} className="text-rowan-green font-medium">
          Sign Up
        </button>
      </p>

      {onBack && (
        <button onClick={onBack} className="text-rowan-muted text-xs mt-8 underline min-h-9">
          ← Back to Wallet
        </button>
      )}
      <p className="text-center text-[11px] text-rowan-muted leading-relaxed mt-6">
        <Link to="/legal/terms" className="underline">Terms of Service</Link>
        {' · '}
        <Link to="/legal/privacy" className="underline">Privacy Policy</Link>
      </p>
    </div>
  );
}
