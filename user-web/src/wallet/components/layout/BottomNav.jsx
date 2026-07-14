import { NavLink } from 'react-router-dom'
import { House, ArrowLeftRight, Clock, UserCircle } from 'lucide-react'

const tabs = [
  { path: '/wallet/home', label: 'Home', Icon: House },
  { path: '/wallet/p2p', label: 'P2P', Icon: ArrowLeftRight },
  { path: '/wallet/history', label: 'History', Icon: Clock },
  { path: '/wallet/profile', label: 'You', Icon: UserCircle },
]

/** Kept for compatibility; AppShell embeds nav for web. */
export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-rowan-surface border-t border-rowan-border z-40">
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
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
