import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../shared/context/AuthContext'
import { LogOut, BarChart3, DollarSign, Users, AlertCircle, Settings, TrendingUp, Zap, FileText } from 'lucide-react'

/**
 * Sidebar navigation component
 */
export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const isActive = (path) => location.pathname.startsWith(path)

  const links = [
    { path: '/', icon: BarChart3, label: 'Overview' },
    { path: '/transactions', icon: DollarSign, label: 'Transactions' },
    { path: '/traders', icon: Users, label: 'Traders' },
    { path: '/disputes', icon: AlertCircle, label: 'Disputes' },
    { path: '/analytics', icon: TrendingUp, label: 'Analytics' },
    { path: '/escrow', icon: Zap, label: 'Escrow' },
    { path: '/rates', icon: BarChart3, label: 'Rates' },
    { path: '/health', icon: Settings, label: 'Health' },
    { path: '/audit-logs', icon: FileText, label: 'Audit Logs' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-64 bg-rowan-surface border-r border-rowan-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-rowan-border">
        <h1 className="text-2xl font-bold text-rowan-yellow">Rowan</h1>
        <p className="text-xs text-rowan-muted">Admin Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {links.map(({ path, icon: IconComponent, label }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive(path)
                ? 'bg-rowan-yellow/10 text-rowan-yellow border-l-2 border-rowan-yellow'
                : 'text-rowan-muted hover:text-rowan-text hover:bg-rowan-bg'
            }`}
          >
            <IconComponent size={20} />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-rowan-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-rowan-muted hover:text-rowan-red hover:bg-rowan-red/10 transition-colors text-sm font-medium"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
