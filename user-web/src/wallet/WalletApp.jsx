/**
 * WalletApp — sub-router for authenticated wallet users.
 * All wallet routes live here, isolated from trader routes.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { SocketProvider } from './context/SocketContext';
import { NotificationsProvider } from './context/NotificationsContext';
import usePushNotifications from './hooks/usePushNotifications';

import AppShell from './components/layout/AppShell';

import Onboarding from './pages/Onboarding';
import WalletSetup from './pages/WalletSetup';
import CreateWallet from './pages/CreateWallet';
import BackupWallet from './pages/BackupWallet';
import ImportWallet from './pages/ImportWallet';
import Register from './pages/Register';
import Home from './pages/Home';
import P2pHub from './pages/P2pHub';
import Marketplace from './pages/Marketplace';
import TraderProfile from './pages/TraderProfile';
import BlockedTraders from './pages/BlockedTraders';
import ReceiveXlm from './pages/ReceiveXlm';
import AddMoney from './pages/AddMoney';
import Buy from './pages/Buy'
import BuyConfirm from './pages/BuyConfirm'
import Cashout from './pages/Cashout';
import CashoutConfirm from './pages/CashoutConfirm';
import CashoutSend from './pages/CashoutSend';
import TransactionStatus from './pages/TransactionStatus';
import History from './pages/History';
import TransactionDetail from './pages/TransactionDetail';
import TransactionReceipt from './pages/TransactionReceipt';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Help from './pages/Help';
import DisputeForm from './pages/DisputeForm';
import BiometricSetup from './pages/BiometricSetup';
import RateAlerts from './pages/RateAlerts';
import TwoFactorSettings from './pages/security/TwoFactorSettings';

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
        <Routes>
            {/* Tab routes with bottom nav */}
            <Route element={<AppShell />}>
              <Route path="home" element={<Home />} />
              <Route path="p2p" element={<P2pHub />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Full-screen routes without bottom nav */}
            <Route path="notifications" element={<Notifications />} />
            <Route path="receive" element={<ReceiveXlm />} />
            <Route path="add-money" element={<AddMoney />} />
            <Route path="buy" element={<Buy />} />
            <Route path="buy/confirm" element={<BuyConfirm />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="traders/:id" element={<TraderProfile />} />
            <Route path="blocked-traders" element={<BlockedTraders />} />
            <Route path="cashout" element={<Cashout />} />
            <Route path="cashout/confirm" element={<CashoutConfirm />} />
            <Route path="cashout/send" element={<CashoutSend />} />
            <Route path="transaction/:id" element={<TransactionStatus />} />
            <Route path="history/:id" element={<TransactionDetail />} />
            <Route path="dispute/:id" element={<DisputeForm />} />
            <Route path="biometric-setup" element={<BiometricSetup />} />
            <Route path="rate-alerts" element={<RateAlerts />} />
            <Route path="help" element={<Help />} />
            <Route path="security/2fa" element={<TwoFactorSettings />} />
            <Route path="receipt/:transactionId" element={<TransactionReceipt />} />

            {/* Catch-all within wallet */}
            <Route path="*" element={<Navigate to="home" replace />} />
          </Routes>
      </NotificationsProvider>
    </SocketProvider>
  );
}
