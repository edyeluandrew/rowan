/**
 * User-web App — casual wallet only (no trader routes).
 */
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, ROLE_WALLET } from './context/AuthContext'
import SplashScreen from './SplashScreen'
import Login from './Login'
import WalletSetup from './wallet/pages/WalletSetup'
import CreateWallet from './wallet/pages/CreateWallet'
import BackupWallet from './wallet/pages/BackupWallet'
import ImportWallet from './wallet/pages/ImportWallet'
import Register from './wallet/pages/Register'
import WalletTwoFactorVerify from './wallet/pages/WalletTwoFactorVerify'

const WalletApp = lazy(() => import('./wallet/WalletApp'))

function PublicOnly({ children }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/wallet/home" replace />
  return children
}

export default function App() {
  const { isAuthenticated, isLoading, role } = useAuth()

  if (isLoading) return <SplashScreen />

  return (
    <Routes>
      <Route path="/wallet-setup" element={<PublicOnly><WalletSetup /></PublicOnly>} />
      <Route path="/create-wallet" element={<PublicOnly><CreateWallet /></PublicOnly>} />
      <Route path="/backup-wallet" element={<PublicOnly><BackupWallet /></PublicOnly>} />
      <Route path="/import-wallet" element={<PublicOnly><ImportWallet /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/wallet-2fa-verify" element={<PublicOnly><WalletTwoFactorVerify /></PublicOnly>} />

      <Route
        path="/wallet/*"
        element={
          isAuthenticated && role === ROLE_WALLET
            ? (
              <Suspense fallback={<SplashScreen />}>
                <WalletApp />
              </Suspense>
            )
            : <Navigate to="/" replace />
        }
      />

      <Route
        path="/"
        element={
          isAuthenticated && role === ROLE_WALLET
            ? <Navigate to="/wallet/home" replace />
            : <Login />
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
