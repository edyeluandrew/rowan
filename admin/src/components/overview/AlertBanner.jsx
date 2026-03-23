import { AlertTriangle, Info, XCircle } from 'lucide-react'

const ICONS = {
  warning: AlertTriangle,
  info: Info,
  critical: XCircle,
}

const COLORS = {
  warning: 'bg-rowan-orange/10 border-rowan-orange/30 text-rowan-orange',
  info: 'bg-rowan-blue/10 border-rowan-blue/30 text-rowan-blue',
  critical: 'bg-rowan-red/10 border-rowan-red/30 text-rowan-red',
}

export default function AlertBanner({ alerts = [] }) {
  if (alerts.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => {
        const severity = alert.severity || 'info'
        const Icon = ICONS[severity] || ICONS.info
        return (
          <div
            key={alert.id}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm ${COLORS[severity] || COLORS.info}`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{alert.message}</span>
            <span className="text-xs opacity-70">{alert.timestamp}</span>
          </div>
        )
      })}
    </div>
  )
}
