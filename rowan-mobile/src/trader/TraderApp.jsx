/**
 * TraderApp — sub-router for authenticated OTC-trader users.
 * All routes here are rendered inside /trader/* from App.jsx.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';

import OnboardingGate from './pages/onboarding/OnboardingGate';
import OnboardingWizard from './pages/onboarding/OnboardingWizard';
import AppShell from './components/layout/AppShell';

import Home from './pages/Home';
import Requests from './pages/Requests';
import RequestDetail from './pages/RequestDetail';
import History from './pages/History';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Earnings from './pages/Earnings';
import DisputeDetail from './pages/DisputeDetail';
import StellarWallet from './pages/StellarWallet';
import SlaTracker from './pages/SlaTracker';
import NetworkPerformance from './pages/NetworkPerformance';

import SecuritySettings from './pages/security/SecuritySettings';
import ChangePassword from './pages/security/ChangePassword';
import ActiveSessions from './pages/security/ActiveSessions';

export default function TraderApp() {
  return (
    <SocketProvider>
      <Routes>
        {/* Onboarding flow (before full access) */}
        <Route path="onboarding" element={<OnboardingWizard />} />

        {/* All main routes behind onboarding gate */}
        <Route element={<OnboardingGate />}>
          {/* Tab routes with bottom nav */}
          <Route element={<AppShell />}>
            <Route path="home" element={<Home />} />
            <Route path="requests" element={<Requests />} />
            <Route path="history" element={<History />} />
            <Route path="profile" element={<Profile />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>

          {/* Full-screen routes */}
          <Route path="requests/:id" element={<RequestDetail />} />
          <Route path="earnings" element={<Earnings />} />
          <Route path="disputes/:id" element={<DisputeDetail />} />
          <Route path="wallet" element={<StellarWallet />} />
          <Route path="sla" element={<SlaTracker />} />
          <Route path="performance/networks" element={<NetworkPerformance />} />

          {/* Security sub-routes */}
          <Route path="security" element={<SecuritySettings />} />
          <Route path="security/change-password" element={<ChangePassword />} />
          <Route path="security/sessions" element={<ActiveSessions />} />
        </Route>

        {/* Catch-all within trader */}
        <Route path="*" element={<Navigate to="home" replace />} />
      </Routes>
    </SocketProvider>
  );
}
