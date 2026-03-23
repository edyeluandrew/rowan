import { BellDot } from 'lucide-react'

/**
 * Bell icon with unread count overlay.
 */
export default function NotificationBadge({ unreadCount, onClick }) {
  return (
    <button onClick={onClick} className="relative p-1 min-h-11 min-w-11 flex items-center justify-center">
      <BellDot size={22} className={unreadCount > 0 ? 'text-rowan-yellow' : 'text-rowan-muted'} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rowan-red rounded-full text-[9px] text-white flex items-center justify-center font-bold">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
