import { NavLink } from 'react-router-dom'
import { House, ArrowDownToLine, Clock, Bell, UserCircle } from 'lucide-react'
import { useNotificationsContext } from '../../context/NotificationsContext'
import NotificationBadge from '../ui/NotificationBadge'

const tabs = [
  { path: '/wallet/home', label: 'Home', Icon: House },
  { path: '/wallet/cashout', label: 'Cash Out', Icon: ArrowDownToLine, primary: true },
  { path: '/wallet/history', label: 'History', Icon: Clock },
  { path: '/wallet/notifications', label: 'Alerts', Icon: Bell },
  { path: '/wallet/profile', label: 'Profile', Icon: UserCircle },
]

/**
 * Fixed bottom navigation bar.
 */
export default function BottomNav() {
  const { unreadCount } = useNotificationsContext()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-rowan-surface border-t border-rowan-border z-40 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ path, label, Icon, primary }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-11 relative ${
                primary
                  ? 'text-rowan-yellow'
                  : isActive
                  ? 'text-rowan-yellow'
                  : 'text-rowan-muted'
              }`
            }
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
            {path === '/wallet/notifications' && (
              <NotificationBadge count={unreadCount} />
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
