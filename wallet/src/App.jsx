import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { NotificationsProvider } from './context/NotificationsContext'
import usePushNotifications from './hooks/usePushNotifications'
import { CURRENT_NETWORK } from './utils/constants'

import AppShell from './components/layout/AppShell'
import LoadingSpinner from './components/ui/LoadingSpinner'

import Onboarding from './pages/Onboarding'
import WalletSetup from './pages/WalletSetup'
import CreateWallet from './pages/CreateWallet'
import BackupWallet from './pages/BackupWallet'
import ImportWallet from './pages/ImportWallet'
import Register from './pages/Register'
import Home from './pages/Home'
import Cashout from './pages/Cashout'
import CashoutConfirm from './pages/CashoutConfirm'
import CashoutSend from './pages/CashoutSend'
import TransactionStatus from './pages/TransactionStatus'
import History from './pages/History'
import TransactionDetail from './pages/TransactionDetail'
import TransactionReceipt from './pages/TransactionReceipt'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import DisputeForm from './pages/DisputeForm'
import BiometricSetup from './pages/BiometricSetup'
import RateAlerts from './pages/RateAlerts'

function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <FullScreenLoader />
  if (isAuthenticated) return <Navigate to="/home" replace />
  return children
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <FullScreenLoader />
  if (!isAuthenticated) return <Navigate to="/onboarding" replace />
  return children
}

/** Initialize push notifications once on first authenticated render */
function PushNotificationInit() {
  const { initialize } = usePushNotifications()
  useEffect(() => { initialize() }, [initialize])
  return null
}

function FullScreenLoader() {
  return (
    <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
      <LoadingSpinner size={32} />
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/onboarding" element={<PublicRoute><Onboarding /></PublicRoute>} />
      <Route path="/wallet-setup" element={<PublicRoute><WalletSetup /></PublicRoute>} />
      <Route path="/create-wallet" element={<PublicRoute><CreateWallet /></PublicRoute>} />
      <Route path="/backup-wallet" element={<PublicRoute><BackupWallet /></PublicRoute>} />
      <Route path="/import-wallet" element={<PublicRoute><ImportWallet /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Protected routes with bottom nav */}
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/home" element={<Home />} />
        <Route path="/history" element={<History />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Protected routes without bottom nav */}
      <Route path="/cashout" element={<ProtectedRoute><Cashout /></ProtectedRoute>} />
      <Route path="/cashout/confirm" element={<ProtectedRoute><CashoutConfirm /></ProtectedRoute>} />
      <Route path="/cashout/send" element={<ProtectedRoute><CashoutSend /></ProtectedRoute>} />
      <Route path="/transaction/:id" element={<ProtectedRoute><TransactionStatus /></ProtectedRoute>} />
      <Route path="/history/:id" element={<ProtectedRoute><TransactionDetail /></ProtectedRoute>} />
      <Route path="/dispute/:id" element={<ProtectedRoute><DisputeForm /></ProtectedRoute>} />
      <Route path="/biometric-setup" element={<ProtectedRoute><BiometricSetup /></ProtectedRoute>} />
      <Route path="/rate-alerts" element={<ProtectedRoute><RateAlerts /></ProtectedRoute>} />
      <Route path="/receipt/:transactionId" element={<ProtectedRoute><TransactionReceipt /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/onboarding" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <NotificationsProvider>
            <PushNotificationInit />
            {CURRENT_NETWORK.isTest && (
              <div className="fixed top-0 left-0 right-0 z-50 bg-rowan-yellow text-rowan-bg text-xs font-bold text-center py-1">
                TESTNET — Not real funds
              </div>
            )}
            <div className={CURRENT_NETWORK.isTest ? 'pt-7' : ''}>
              <AppRoutes />
            </div>
          </NotificationsProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
