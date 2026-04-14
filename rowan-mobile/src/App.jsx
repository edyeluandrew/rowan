/**
 * App.jsx — role-based router.
 *
 * Routing strategy:
 *   isLoading              → SplashScreen
 *   pre-auth wallet routes → wallet setup flow (before auth is established)
 *   pre-auth trader routes → signup / forgot-password / reset-password
 *   authenticated user     → WalletApp  (/wallet/*)
 *   authenticated trader   → TraderApp  (/trader/*)
 *   unauthenticated        → Login
 */
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, ROLE_WALLET, ROLE_TRADER } from './context/AuthContext';
import SplashScreen from './SplashScreen';
import Login from './Login';

/* ── Wallet pre-auth pages (onboarding / wallet creation) ── */
import WalletSetup from './wallet/pages/WalletSetup';
import CreateWallet from './wallet/pages/CreateWallet';
import BackupWallet from './wallet/pages/BackupWallet';
import ImportWallet from './wallet/pages/ImportWallet';
import Register from './wallet/pages/Register';
import WalletTwoFactorVerify from './wallet/pages/WalletTwoFactorVerify';

/* ── Trader pre-auth pages ── */
import Signup from './trader/pages/Signup';
import ForgotPassword from './trader/pages/auth/ForgotPassword';
import ResetPassword from './trader/pages/auth/ResetPassword';
import TwoFactorVerify from './trader/pages/security/TwoFactorVerify';

/* ── Authenticated sub-routers (lazy-loaded for code-splitting) ── */
const WalletApp = lazy(() => import('./wallet/WalletApp'));
const TraderApp = lazy(() => import('./trader/TraderApp'));

/** Guard: renders children only when NOT authenticated, else redirects */
function PublicOnly({ children, redirectTo }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;
  return children;
}

export default function App() {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) return <SplashScreen />;

  const homeFor = (r) => (r === ROLE_TRADER ? '/trader/home' : '/wallet/home');

  return (
    <Routes>
      {/* ── Wallet pre-auth flow ── */}
      <Route
        path="/wallet-setup"
        element={<PublicOnly redirectTo="/wallet/home"><WalletSetup /></PublicOnly>}
      />
      <Route
        path="/create-wallet"
        element={<PublicOnly redirectTo="/wallet/home"><CreateWallet /></PublicOnly>}
      />
      <Route
        path="/backup-wallet"
        element={<PublicOnly redirectTo="/wallet/home"><BackupWallet /></PublicOnly>}
      />
      <Route
        path="/import-wallet"
        element={<PublicOnly redirectTo="/wallet/home"><ImportWallet /></PublicOnly>}
      />
      <Route
        path="/register"
        element={<PublicOnly redirectTo="/wallet/home"><Register /></PublicOnly>}
      />
      <Route
        path="/wallet-2fa-verify"
        element={<PublicOnly redirectTo="/wallet/home"><WalletTwoFactorVerify /></PublicOnly>}
      />

      {/* ── Trader pre-auth routes ── */}
      <Route
        path="/trader/signup"
        element={<PublicOnly redirectTo="/trader/home"><Signup /></PublicOnly>}
      />
      <Route
        path="/trader/forgot-password"
        element={<PublicOnly redirectTo="/trader/home"><ForgotPassword /></PublicOnly>}
      />
      <Route
        path="/trader/reset-password"
        element={<PublicOnly redirectTo="/trader/home"><ResetPassword /></PublicOnly>}
      />
      <Route
        path="/trader/2fa-verify"
        element={<PublicOnly redirectTo="/trader/home"><TwoFactorVerify /></PublicOnly>}
      />

      {/* ── Authenticated sub-routers (lazy-loaded) ── */}
      <Route
        path="/wallet/*"
        element={
          isAuthenticated && role === ROLE_WALLET
            ? <Suspense fallback={<SplashScreen />}><WalletApp /></Suspense>
            : <Navigate to="/" replace />
        }
      />
      <Route
        path="/trader/*"
        element={
          isAuthenticated && role === ROLE_TRADER
            ? <Suspense fallback={<SplashScreen />}><TraderApp /></Suspense>
            : <Navigate to="/" replace />
        }
      />

      {/* ── Catch-all ── */}
      <Route
        path="*"
        element={
          isAuthenticated
            ? <Navigate to={homeFor(role)} replace />
            : <Login />
        }
      />
    </Routes>
  );
}
