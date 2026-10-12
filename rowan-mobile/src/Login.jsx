/**
 * Login.jsx — unified entry point.
 *
 * Default view: an auto-playing story carousel of what Rowan does, over the
 * wallet onboarding CTAs (create/import wallet).
 * Bottom link: "OTC Trader? Sign In" → switches to trader email/password form.
 *
 * No role selector dropdown — the mode is determined by the user's action.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { getSecure } from './shared/utils/storage';
import { formatAddress } from './wallet/utils/format';
import WalletTwoFactorLoginModal from './wallet/pages/WalletTwoFactorLoginModal';
import RowanLogo from './components/RowanLogo';
import MapInflowVisual from './components/story/MapInflowVisual';
import CashoutVisual from './components/story/CashoutVisual';
import ScanReceiveVisual from './components/story/ScanReceiveVisual';
import BillsVisual from './components/story/BillsVisual';
import { isMissingWalletAccount } from './wallet/utils/apiErrors';
import TraderLoginForm from './trader/pages/TraderLoginForm';

const SLIDES = [
  {
    Visual: MapInflowVisual,
    title: 'USDC lands in Uganda',
    desc: 'Family and clients send you dollars from anywhere. They arrive in seconds, not days.',
  },
  {
    Visual: CashoutVisual,
    title: 'Cash out to mobile money',
    desc: 'Turn USDC into MTN MoMo or Airtel Money through escrow-protected traders.',
  },
  {
    Visual: ScanReceiveVisual,
    title: 'Get paid with a scan',
    desc: 'Show your code, they scan, and the money is in your wallet before they walk away.',
  },
  {
    Visual: BillsVisual,
    title: 'Pay bills and buy airtime',
    desc: 'UMEME, water, data and airtime — straight from your USDC balance.',
  },
];

const SLIDE_MS = 6500;
const SWIPE_PX = 45;

async function tapFeedback() {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* haptics not available on web */
  }
}

export default function Login() {
  const { loginWithWallet, setWalletAuthAfter2FA } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('wallet'); // 'wallet' | 'trader'
  const [slide, setSlide] = useState(0);
  const [back, setBack] = useState(false);
  const [storedPublicKey, setStoredPublicKey] = useState(null);
  const [walletChecked, setWalletChecked] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState(null);
  const [show2faModal, setShow2faModal] = useState(false);
  const [tempUserId, setTempUserId] = useState(null);
  const touchStartX = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getSecure('rowan_stellar_keypair');
        if (!stored) return;
        const kp = JSON.parse(stored);
        if (kp?.publicKey) setStoredPublicKey(kp.publicKey);
      } catch {
        /* treat as no stored wallet */
      } finally {
        setWalletChecked(true);
      }
    })();
  }, []);

  const goTo = useCallback(
    (next, viaGesture) => {
      setBack(next < slide);
      setSlide((next + SLIDES.length) % SLIDES.length);
      if (viaGesture) tapFeedback();
    },
    [slide],
  );

  useEffect(() => {
    if (mode !== 'wallet' || show2faModal) return undefined;
    const id = window.setTimeout(() => goTo(slide + 1), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [slide, mode, show2faModal, goTo]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_PX) return;
    goTo(delta < 0 ? slide + 1 : slide - 1, true);
  };

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
      if (isMissingWalletAccount(err)) {
        navigate('/register', { replace: true });
        return;
      }
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

  /* ── TRADER MODE ── */
  if (mode === 'trader') {
    return <TraderLoginForm onBack={() => setMode('wallet')} />;
  }

  /* ── WALLET MODE (default) ── */
  const current = SLIDES[slide];
  const Visual = current.Visual;

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-rowan-bg">
      {/* Ambient brand wash */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_0%,rgba(240,185,11,0.13),transparent_60%),radial-gradient(ellipse_70%_40%_at_50%_100%,rgba(240,185,11,0.07),transparent_55%)]"
        aria-hidden="true"
      />

      <div className="relative flex min-h-[100dvh] flex-col px-5 pb-5 safe-top safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between pt-3">
          <RowanLogo size={28} />
          <button
            onClick={() => setMode('trader')}
            className="rounded-full border border-rowan-border bg-rowan-surface px-3 py-1.5 text-[11px] font-semibold text-rowan-muted min-h-9"
          >
            OTC Trader
          </button>
        </div>

        {/* Story progress */}
        <div className="mt-4 flex gap-1.5" role="tablist" aria-label="Product tour">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              role="tab"
              aria-selected={i === slide}
              aria-label={s.title}
              onClick={() => goTo(i, true)}
              className="flex-1 py-2"
            >
              <span className="ob-progress-track block">
                <span
                  key={`${i}-${slide}`}
                  className={`ob-progress-fill ${
                    i === slide ? 'is-live' : i < slide ? 'is-done' : 'is-idle'
                  }`}
                  style={i === slide ? { '--ob-duration': `${SLIDE_MS}ms` } : undefined}
                />
              </span>
            </button>
          ))}
        </div>

        {/* Slide */}
        <div
          className="scrollbar-hide flex min-h-0 flex-1 flex-col justify-center overflow-y-auto"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div key={slide} className={`ob-slide${back ? ' is-back' : ''}`}>
            <div className="flex min-h-[236px] items-center justify-center py-3">
              <Visual />
            </div>

            <div className="ob-copy mt-5 text-center">
              <h1 className="text-[26px] font-bold leading-tight tracking-tight text-rowan-text">
                {current.title}
              </h1>
              <p className="mx-auto mt-2.5 max-w-[19rem] text-sm leading-relaxed text-rowan-muted">
                {current.desc}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 w-full space-y-3">
          {!walletChecked || storedPublicKey ? (
            <>
              <button
                onClick={handleOpenWallet}
                disabled={walletLoading || !walletChecked}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-rowan-green py-4 text-base font-bold text-white shadow-[0_10px_24px_rgba(240,185,11,0.28)] transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {walletLoading ? 'Signing in…' : 'Log in'}
                {walletChecked && !walletLoading && <ArrowRight size={18} />}
              </button>
              {storedPublicKey && (
                <>
                  <p className="text-center text-xs text-rowan-muted tabular-nums">
                    {formatAddress(storedPublicKey)}
                  </p>
                  <button
                    onClick={() => navigate('/wallet-setup')}
                    disabled={walletLoading}
                    className="min-h-11 w-full text-center text-sm text-rowan-muted"
                  >
                    Set up a different wallet
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/wallet-setup')}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-rowan-green py-4 text-base font-bold text-white shadow-[0_10px_24px_rgba(240,185,11,0.28)] transition-transform active:scale-[0.98]"
              >
                Get started <ArrowRight size={18} />
              </button>
              <p className="text-center text-[11px] leading-relaxed text-rowan-muted">
                Non-custodial · your keys stay on this device
              </p>
            </>
          )}

          {walletError && <p className="text-center text-sm text-rowan-red">{walletError}</p>}
          <LegalLinks className="pt-1" />
        </div>
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

function LegalLinks({ className = '' }) {
  return (
    <p className={`text-center text-[11px] text-rowan-muted leading-relaxed ${className}`}>
      <Link to="/legal/terms" className="underline">Terms of Service</Link>
      {' · '}
      <Link to="/legal/privacy" className="underline">Privacy Policy</Link>
    </p>
  );
}
