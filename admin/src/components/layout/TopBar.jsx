import { RefreshCw, Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function TopBar({ title, onRefresh, refreshing = false, alertCount = 0 }) {
  const { admin } = useAuth()
  const initials = (() => {
    if (!admin) return 'A'
    const name = admin.name || admin.email || ''
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'A'
  })()

  return (
    <header className="h-14 border-b border-rowan-border bg-rowan-base flex items-center justify-between px-6 shrink-0">
      <h2 className="text-rowan-text font-bold text-lg">{title}</h2>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-rowan-muted hover:text-rowan-text p-1.5 rounded-lg hover:bg-rowan-surface transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}

        <button className="relative text-rowan-muted hover:text-rowan-text p-1.5 rounded-lg hover:bg-rowan-surface transition-colors">
          <Bell size={16} />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-rowan-red text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>

        <div className="w-8 h-8 rounded-full bg-rowan-yellow/20 text-rowan-yellow flex items-center justify-center text-xs font-bold">
          {initials}
        </div>
      </div>
    </header>
  )
}
