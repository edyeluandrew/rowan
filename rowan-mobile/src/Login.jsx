/**
 * Login.jsx — unified entry point.
 *
 * Default view: wallet onboarding (create/import wallet).
 * Bottom link: "OTC Trader? Sign In" → switches to trader email/password form.
 *
 * No role selector dropdown — the mode is determined by the user's action.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Lock, Smartphone, ArrowRight } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { loginTrader as apiLoginTrader } from './trader/api/auth';
import { getSecure } from './shared/utils/storage';
import { formatAddress } from './wallet/utils/format';
import WalletTwoFactorLoginModal from './wallet/pages/WalletTwoFactorLoginModal';

const SLIDES = [
  { Icon: Star, title: 'Your Stellar Wallet', desc: 'Send, receive, and cash out XLM directly from your phone.' },
  { Icon: Lock, title: 'Secure by Design', desc: 'Private keys stored in hardware-encrypted secure storage.' },
  { Icon: Smartphone, title: 'Mobile Money Cashout', desc: 'Convert XLM to mobile money in minutes via matched OTC traders.' },
];

export default function Login() {
  const { loginAsTrader, loginWithWallet, setWalletAuthAfter2FA } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('wallet'); // 'wallet' | 'trader'
  const [slide, setSlide] = useState(0);
  const [storedPublicKey, setStoredPublicKey] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState(null);
  const [show2faModal, setShow2faModal] = useState(false);
  const [tempUserId, setTempUserId] = useState(null);

  // Trader form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getSecure('rowan_stellar_keypair');
        if (!stored) return;
        const kp = JSON.parse(stored);
        if (kp?.publicKey) setStoredPublicKey(kp.publicKey);
      } catch {
        /* treat as no stored wallet */
      }
    })();
  }, []);

  const handleOpenWallet = async () => {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const response = await loginWithWallet();
      if (response?.requiresTwoFactorVerification === true) {
        setTempUserId(response.userId);
        setShow2faModal(true);
      } else {
        navigate('/wallet/home', { replace: true });
      }
    } catch (err) {
      setWalletError(err.message || 'Could not open wallet');
    } finally {
      setWalletLoading(false);
    }
  };

  const handleWalletAfter2FA = async (verifyResponse) => {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const keypair = await getSecure('rowan_stellar_keypair');
      const kpData = keypair ? JSON.parse(keypair) : null;
      await setWalletAuthAfter2FA(
        verifyResponse.token,
        verifyResponse.user || { id: tempUserId },
        kpData,
      );
      setShow2faModal(false);
      setTempUserId(null);
      navigate('/wallet/home', { replace: true });
    } catch (err) {
      setWalletError(err.message || 'Verification failed. Please try again.');
    } finally {
      setWalletLoading(false);
    }
  };

  const handle2faCancel = () => {
    setShow2faModal(false);
    setTempUserId(null);
    setWalletError('Authentication cancelled. Please try again.');
  };

  const handleTraderLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiLoginTrader(email, password);

      // Check if 2FA is required
      if (response.requiresTwoFactor) {
        // Navigate to 2FA verification page with traderId
        navigate('/trader/2fa-verify', {
          replace: true,
          state: { traderId: response.traderId },
        });
      } else {
        // No 2FA: Proceed with normal login
        await loginAsTrader(email, password);
        navigate('/trader/home', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  /* ── TRADER MODE ── */
  if (mode === 'trader') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-rowan-bg">
        <h1 className="text-rowan-yellow text-4xl font-bold tracking-widest">ROWAN</h1>
        <p className="text-rowan-muted text-sm mt-2">OTC Trader Portal</p>

        <form onSubmit={handleTraderLogin} className="mt-12 w-full max-w-sm">
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-4 py-3.5 w-full text-base focus:outline-none focus:border-rowan-yellow transition-colors mb-3 placeholder-rowan-muted min-h-11"
          />
          <div className="relative mb-4">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-4 py-3.5 w-full text-base focus:outline-none focus:border-rowan-yellow transition-colors pr-14 placeholder-rowan-muted min-h-11"
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
            className="flex items-center justify-center gap-2 font-bold rounded-xl py-4 w-full text-base bg-rowan-yellow text-rowan-bg transition-opacity disabled:opacity-50 min-h-11"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {error && <p className="text-rowan-red text-sm mt-3 text-center">{error}</p>}

          <button
            type="button"
            onClick={() => navigate('/trader/forgot-password')}
            className="block w-full text-center text-rowan-muted text-xs mt-3 hover:text-rowan-yellow transition-colors min-h-9"
          >
            Forgot Password?
          </button>
        </form>

        <p className="text-rowan-muted text-sm mt-6">
          {"Don't have a trader account? "}
          <button
            onClick={() => navigate('/trader/signup')}
            className="text-rowan-yellow font-medium"
          >
            Sign Up
          </button>
        </p>

        <button
          onClick={() => setMode('wallet')}
          className="text-rowan-muted text-xs mt-8 underline min-h-9"
        >
          ← Back to Wallet
        </button>
      </div>
    );
  }

  /* ── WALLET MODE (default) ── */
  const current = SLIDES[slide];
  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col items-center justify-between px-6 py-12">
      {/* Slide */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xs">
        <div className="w-20 h-20 rounded-full bg-rowan-yellow/10 flex items-center justify-center mb-6">
          <current.Icon size={40} className="text-rowan-yellow" />
        </div>
        <h2 className="text-rowan-text text-xl font-bold">{current.title}</h2>
        <p className="text-rowan-muted text-sm mt-3">{current.desc}</p>

        {/* Dots */}
        <div className="flex gap-2 mt-6">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === slide ? 'bg-rowan-yellow' : 'bg-rowan-border'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm space-y-3">
        {slide < SLIDES.length - 1 ? (
          <button
            onClick={() => setSlide((s) => s + 1)}
            className="flex items-center justify-center gap-2 font-bold rounded-xl py-4 w-full text-base bg-rowan-yellow text-rowan-bg min-h-11"
          >
            Next <ArrowRight size={18} />
          </button>
        ) : storedPublicKey ? (
          <>
            <button
              onClick={handleOpenWallet}
              disabled={walletLoading}
              className="flex items-center justify-center gap-2 font-bold rounded-xl py-4 w-full text-base bg-rowan-yellow text-rowan-bg min-h-11 disabled:opacity-50"
            >
              {walletLoading ? 'Opening wallet...' : 'Open my wallet'}
            </button>
            <p className="text-rowan-muted text-xs text-center">
              {formatAddress(storedPublicKey)}
            </p>
            <button
              onClick={() => navigate('/wallet-setup')}
              disabled={walletLoading}
              className="w-full text-center text-rowan-muted text-sm min-h-11"
            >
              Set up a different wallet
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate('/wallet-setup')}
            className="flex items-center justify-center gap-2 font-bold rounded-xl py-4 w-full text-base bg-rowan-yellow text-rowan-bg min-h-11"
          >
            Get Started
          </button>
        )}

        {slide === SLIDES.length - 1 && walletError && (
          <p className="text-rowan-red text-sm text-center">{walletError}</p>
        )}

        {slide === SLIDES.length - 1 && (
          <button
            onClick={() => setMode('trader')}
            className="w-full text-center text-rowan-muted text-xs mt-4 min-h-9"
          >
            OTC Trader? <span className="text-rowan-yellow underline">Sign In</span>
          </button>
        )}
      </div>

      <WalletTwoFactorLoginModal
        isVisible={show2faModal}
        userId={tempUserId}
        onSuccess={handleWalletAfter2FA}
        onCancel={handle2faCancel}
      />
    </div>
  );
}
