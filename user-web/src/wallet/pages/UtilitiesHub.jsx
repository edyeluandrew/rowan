import { NavLink, Outlet } from 'react-router-dom'
import { ChevronLeft, Signal, Wifi } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const TABS = [
  { to: '/wallet/utilities/airtime', label: 'Airtime', Icon: Signal },
  { to: '/wallet/utilities/data', label: 'Data', Icon: Wifi },
]

export default function UtilitiesHub() {
  const navigate = useNavigate()

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-rowan-text text-lg font-bold">Utilities</h1>
        </div>

        <div className="flex gap-2 mb-2">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 min-h-11 text-sm font-medium border ${
                  isActive
                    ? 'bg-rowan-yellow text-rowan-bg border-rowan-yellow'
                    : 'bg-rowan-surface text-rowan-muted border-rowan-border'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
      <Outlet />
    </div>
  )
}
