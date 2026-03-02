import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'

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
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import DisputeForm from './pages/DisputeForm'

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
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
