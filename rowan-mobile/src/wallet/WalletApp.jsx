/**
 * WalletApp — sub-router for authenticated wallet users.
 * All wallet routes live here, isolated from trader routes.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { SocketProvider } from './context/SocketContext';
import { NotificationsProvider } from './context/NotificationsContext';
import usePushNotifications from './hooks/usePushNotifications';
import { CURRENT_NETWORK } from './utils/constants';

import AppShell from './components/layout/AppShell';

import Onboarding from './pages/Onboarding';
import WalletSetup from './pages/WalletSetup';
import CreateWallet from './pages/CreateWallet';
import BackupWallet from './pages/BackupWallet';
import ImportWallet from './pages/ImportWallet';
import Register from './pages/Register';
import Home from './pages/Home';
import Cashout from './pages/Cashout';
import CashoutConfirm from './pages/CashoutConfirm';
import CashoutSend from './pages/CashoutSend';
import TransactionStatus from './pages/TransactionStatus';
import History from './pages/History';
import TransactionDetail from './pages/TransactionDetail';
import TransactionReceipt from './pages/TransactionReceipt';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import DisputeForm from './pages/DisputeForm';
import BiometricSetup from './pages/BiometricSetup';
import RateAlerts from './pages/RateAlerts';

/** Initialize push notifications once on first authenticated render */
function PushNotificationInit() {
  const { initialize } = usePushNotifications();
  useEffect(() => { initialize(); }, [initialize]);
  return null;
}

export default function WalletApp() {
  return (
    <SocketProvider>
      <NotificationsProvider>
        <PushNotificationInit />
        {CURRENT_NETWORK.isTest && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-rowan-yellow text-rowan-bg text-xs font-bold text-center py-1">
            TESTNET — Not real funds
          </div>
        )}
        <div className={CURRENT_NETWORK.isTest ? 'pt-7' : ''}>
          <Routes>
            {/* Tab routes with bottom nav */}
            <Route element={<AppShell />}>
              <Route path="home" element={<Home />} />
              <Route path="history" element={<History />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Full-screen routes without bottom nav */}
            <Route path="cashout" element={<Cashout />} />
            <Route path="cashout/confirm" element={<CashoutConfirm />} />
            <Route path="cashout/send" element={<CashoutSend />} />
            <Route path="transaction/:id" element={<TransactionStatus />} />
            <Route path="history/:id" element={<TransactionDetail />} />
            <Route path="dispute/:id" element={<DisputeForm />} />
            <Route path="biometric-setup" element={<BiometricSetup />} />
            <Route path="rate-alerts" element={<RateAlerts />} />
            <Route path="receipt/:transactionId" element={<TransactionReceipt />} />

            {/* Catch-all within wallet */}
            <Route path="*" element={<Navigate to="home" replace />} />
          </Routes>
        </div>
      </NotificationsProvider>
    </SocketProvider>
  );
}
