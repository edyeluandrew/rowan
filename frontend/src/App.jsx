import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ToastContainer from './components/ui/ToastContainer';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Requests from './pages/Requests';
import RequestDetail from './pages/RequestDetail';
import History from './pages/History';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Earnings from './pages/Earnings';
import Disputes from './pages/Disputes';
import DisputeDetail from './pages/DisputeDetail';
import StellarWallet from './pages/StellarWallet';
import SlaTracker from './pages/SlaTracker';
import NetworkPerformance from './pages/NetworkPerformance';
import OnboardingGate from './pages/onboarding/OnboardingGate';
import OnboardingWizard from './pages/onboarding/OnboardingWizard';
import SecuritySettings from './pages/security/SecuritySettings';
import ChangePassword from './pages/security/ChangePassword';
import ActiveSessions from './pages/security/ActiveSessions';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} className="text-rowan-yellow" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} className="text-rowan-yellow" />
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/home" replace /> : children;
}

export default function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        }
      />

      {/* Onboarding (authenticated but outside AppShell) */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingWizard />
          </ProtectedRoute>
        }
      />

      {/* Security pages (authenticated, outside AppShell) */}
      <Route
        path="/security"
        element={
          <ProtectedRoute>
            <SecuritySettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security/sessions"
        element={
          <ProtectedRoute>
            <ActiveSessions />
          </ProtectedRoute>
        }
      />

      {/* Dashboard routes — gated by onboarding */}
      <Route
        element={
          <ProtectedRoute>
            <OnboardingGate>
              <AppShell />
            </OnboardingGate>
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/disputes" element={<Disputes />} />
        <Route path="/disputes/:id" element={<DisputeDetail />} />
        <Route path="/wallet" element={<StellarWallet />} />
        <Route path="/sla" element={<SlaTracker />} />
        <Route path="/performance/networks" element={<NetworkPerformance />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
    </>
  );
}
