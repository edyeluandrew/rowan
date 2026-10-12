/**
 * Website entry for the OTC trader app.
 * Renders the same screens as the phone app: sign-in, signup, then TraderApp.
 */
import { useLocation } from 'react-router-dom';
import { useAuth, ROLE_TRADER } from '../context/AuthContext';
import SplashScreen from '../SplashScreen';
import Signup from './pages/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import TwoFactorVerify from './pages/security/TwoFactorVerify';
import TraderLoginForm from './pages/TraderLoginForm';
import TraderApp from './TraderApp';

function isPath(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export default function TraderWebGate() {
  const { isAuthenticated, isLoading, role } = useAuth();
  const { pathname } = useLocation();

  if (isLoading) return <SplashScreen />;

  const ready = isAuthenticated && role === ROLE_TRADER;
  if (ready) return <TraderApp />;

  if (isPath(pathname, '/trader/signup')) return <Signup />;
  if (isPath(pathname, '/trader/forgot-password')) return <ForgotPassword />;
  if (isPath(pathname, '/trader/reset-password')) return <ResetPassword />;
  if (isPath(pathname, '/trader/2fa-verify')) return <TwoFactorVerify />;

  return <TraderLoginForm />;
}
