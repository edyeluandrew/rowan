import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, Signal, Wifi } from 'lucide-react'

const TOP_UP_TABS = [
  { to: '/wallet/utilities/airtime', label: 'Airtime', Icon: Signal },
  { to: '/wallet/utilities/data', label: 'Data', Icon: Wifi },
]

export default function UtilitiesHub() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isBills = pathname.includes('/utilities/bills')
  const title = isBills ? 'Pay Bills' : 'Top up'
  const tabs = isBills ? [] : TOP_UP_TABS

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/wallet/home')}
            className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-rowan-text text-lg font-bold">{title}</h1>
        </div>

        {tabs.length > 0 && (
          <div className="flex gap-2 mb-2">
            {tabs.map(({ to, label, Icon }) => (
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
        )}
      </div>
      <Outlet />
    </div>
  )
}
