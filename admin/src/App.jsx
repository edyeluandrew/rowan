import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './shared/context/AuthContext'
import AppShell from './shared/components/layout/AppShell'
import LoginPage from './features/auth/pages/LoginPage'
import OverviewPage from './features/overview/pages/OverviewPage'
import TransactionsPage from './features/transactions/pages/TransactionsPage'
import TransactionDetailPage from './features/transaction-detail/pages/TransactionDetailPage'
import TradersPage from './features/traders/pages/TradersPage'
import TraderDetailPage from './features/trader-detail/pages/TraderDetailPage'
import DisputesPage from './features/disputes/pages/DisputesPage'
import DisputeDetailPage from './features/dispute-detail/pages/DisputeDetailPage'
import AnalyticsPage from './features/analytics/pages/AnalyticsPage'
import EscrowPage from './features/escrow/pages/EscrowPage'
import ReconciliationPage from './features/reconciliation/pages/ReconciliationPage'
import FraudAlertsPage from './features/fraud/pages/FraudAlertsPage'
import KycSubmissionsPage from './features/kyc/pages/KycSubmissionsPage'
import ScreeningPage from './features/screening/pages/ScreeningPage'
import UsersPage from './features/users/pages/UsersPage'
import RateManagementPage from './features/rates/pages/RateManagementPage'
import SystemHealthPage from './features/system-health/pages/SystemHealthPage'
import AuditLogsPage from './features/audit-logs/pages/AuditLogsPage'

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route index element={<OverviewPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="transactions/:id" element={<TransactionDetailPage />} />
          <Route path="traders" element={<TradersPage />} />
          <Route path="traders/:id" element={<TraderDetailPage />} />
          <Route path="disputes" element={<DisputesPage />} />
          <Route path="disputes/:id" element={<DisputeDetailPage />} />
          <Route path="fraud-alerts" element={<FraudAlertsPage />} />
          <Route path="kyc" element={<KycSubmissionsPage />} />
          <Route path="screening" element={<ScreeningPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="escrow" element={<EscrowPage />} />
          <Route path="reconciliation" element={<ReconciliationPage />} />
          <Route path="rates" element={<RateManagementPage />} />
          <Route path="health" element={<SystemHealthPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
