import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  Flag,
  BarChart3,
  Lock,
  TrendingUp,
  Activity,
  LogOut,
} from 'lucide-react'
import StatusDot from '../ui/StatusDot'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/traders', icon: Users, label: 'Traders' },
  { to: '/disputes', icon: Flag, label: 'Disputes' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/escrow', icon: Lock, label: 'Escrow' },
  { to: '/rates', icon: TrendingUp, label: 'Rates' },
  { to: '/health', icon: Activity, label: 'System Health' },
]

export default function Sidebar({ pendingCounts = {}, systemStatus = 'healthy' }) {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const version = import.meta.env.VITE_APP_VERSION || '0.0.0'

  return (
    <aside className="w-60 h-screen bg-rowan-base border-r border-rowan-border flex flex-col shrink-0">
      <div className="p-4 border-b border-rowan-border">
        <h1 className="text-rowan-text font-bold text-lg tracking-tight">Rowan Admin</h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const count = pendingCounts[label.toLowerCase()]
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm transition-colors ${
                  isActive
                    ? 'bg-rowan-surface text-rowan-yellow font-semibold'
                    : 'text-rowan-muted hover:text-rowan-text hover:bg-rowan-surface/50'
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {label === 'System Health' && (
                <StatusDot status={systemStatus} />
              )}
              {count > 0 && (
                <span className="bg-rowan-yellow/20 text-rowan-yellow text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {count}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-rowan-border p-4">
        {admin && (
          <div className="mb-3">
            <p className="text-rowan-text text-sm font-medium truncate">{admin.name || admin.email}</p>
            <p className="text-rowan-muted text-xs truncate">{admin.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-rowan-muted hover:text-rowan-red text-sm w-full"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
        <p className="text-rowan-muted/50 text-[10px] mt-2">v{version}</p>
      </div>
    </aside>
  )
}
