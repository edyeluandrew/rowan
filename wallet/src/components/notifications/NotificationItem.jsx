import {
  CircleCheckBig, RotateCcw, CircleX, ArrowLeftRight,
  ShieldAlert, Bell,
} from 'lucide-react'
import { formatTimeAgo } from '../../utils/format'

const TYPE_ICONS = {
  transaction_complete: { Icon: CircleCheckBig, color: 'text-rowan-green' },
  transaction_refunded: { Icon: RotateCcw, color: 'text-rowan-yellow' },
  transaction_failed:   { Icon: CircleX, color: 'text-rowan-red' },
  transaction_update:   { Icon: ArrowLeftRight, color: 'text-rowan-muted' },
  dispute_update:       { Icon: ShieldAlert, color: 'text-rowan-red' },
  system:               { Icon: Bell, color: 'text-rowan-muted' },
}

/**
 * Single notification row.
 */
export default function NotificationItem({ notification, onTap }) {
  const { Icon, color } = TYPE_ICONS[notification.type] || TYPE_ICONS.system
  const isUnread = !notification.readAt

  return (
    <button
      onClick={() => onTap(notification)}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left min-h-11 border-b border-rowan-border ${
        isUnread ? 'bg-rowan-yellow/5' : ''
      }`}
    >
      <div className="mt-0.5">
        <Icon size={20} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isUnread ? 'text-rowan-text font-medium' : 'text-rowan-muted'}`}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-rowan-muted text-xs mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-rowan-muted text-xs mt-1">{formatTimeAgo(notification.createdAt)}</p>
      </div>
      {isUnread && <span className="w-2 h-2 rounded-full bg-rowan-yellow flex-shrink-0 mt-2" />}
    </button>
  )
}
