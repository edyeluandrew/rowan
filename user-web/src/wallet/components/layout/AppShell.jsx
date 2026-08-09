import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { House, ArrowLeftRight, Clock, UserCircle, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const tabs = [
  { path: '/wallet/home', label: 'Home', Icon: House },
  { path: '/wallet/p2p', label: 'P2P', Icon: ArrowLeftRight },
  { path: '/wallet/history', label: 'History', Icon: Clock },
  { path: '/wallet/profile', label: 'You', Icon: UserCircle },
]

/**
 * Web shell — sidebar on desktop, bottom nav on mobile widths.
 */
export default function AppShell() {
  const { logout, keypair } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="rowan-atmosphere min-h-screen text-rowan-text lg:flex">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:border-rowan-border/80 lg:bg-rowan-surface/90 lg:backdrop-blur-sm">
        <div className="px-6 py-7">
          <p className="font-serif text-2xl text-rowan-green tracking-tight">Rowan</p>
          <p className="text-rowan-muted text-xs mt-1 font-sans">USDC · mobile money</p>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {tabs.map(({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium min-h-11 transition-colors ${
                  isActive
                    ? 'bg-rowan-green text-white shadow-soft'
                    : 'text-rowan-muted hover:bg-rowan-mint/60 hover:text-rowan-text'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-rowan-border">
          {keypair?.publicKey && (
            <p className="text-rowan-muted text-[10px] font-mono truncate mb-3">
              {keypair.publicKey}
            </p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-rowan-border min-h-10 text-sm text-rowan-muted hover:text-rowan-text hover:bg-rowan-mint/40"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64 min-h-screen overflow-x-hidden">
        <div className="mx-auto w-full max-w-3xl pb-24 lg:pb-10 min-h-screen">
          <Outlet />
        </div>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-rowan-surface/95 backdrop-blur-md border-t border-rowan-border z-40 safe-area-pb shadow-[0_-8px_30px_rgba(12,47,34,0.06)]">
        <div className="flex items-center justify-around h-16">
          {tabs.map(({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-11 ${
                  isActive ? 'text-rowan-green' : 'text-rowan-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                  <span className="text-[10px] font-semibold font-sans">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
