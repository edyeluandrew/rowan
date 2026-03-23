import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Transactions from './pages/Transactions'
import TransactionDetail from './pages/TransactionDetail'
import Traders from './pages/Traders'
import TraderDetail from './pages/TraderDetail'
import Disputes from './pages/Disputes'
import DisputeDetail from './pages/DisputeDetail'
import Analytics from './pages/Analytics'
import Escrow from './pages/Escrow'
import RateManagement from './pages/RateManagement'
import SystemHealth from './pages/SystemHealth'

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
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route index element={<Overview />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="transactions/:id" element={<TransactionDetail />} />
          <Route path="traders" element={<Traders />} />
          <Route path="traders/:id" element={<TraderDetail />} />
          <Route path="disputes" element={<Disputes />} />
          <Route path="disputes/:id" element={<DisputeDetail />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="escrow" element={<Escrow />} />
          <Route path="rates" element={<RateManagement />} />
          <Route path="health" element={<SystemHealth />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
