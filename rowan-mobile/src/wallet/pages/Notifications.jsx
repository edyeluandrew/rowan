import { BellDot, Check, Clock } from 'lucide-react'
import { useNotificationsContext } from '../context/NotificationsContext'
import NotificationItem from '../components/notifications/NotificationItem'

export default function Notifications() {
  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
  } = useNotificationsContext()

  const groupByDate = (items) => {
    const groups = {}
    items.forEach((item) => {
      const date = new Date(item.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      if (!groups[date]) groups[date] = []
      groups[date].push(item)
    })
    return groups
  }

  const grouped = groupByDate(notifications)

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-rowan-text text-lg font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-rowan-yellow text-xs min-h-11"
          >
            <Check size={14} />
            Mark all read
          </button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin text-rowan-muted">
            <Clock size={20} />
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-rowan-surface rounded-xl p-8 text-center">
          <BellDot size={32} className="text-rowan-muted mx-auto mb-3" />
          <p className="text-rowan-muted text-sm">No notifications yet</p>
          <p className="text-rowan-muted text-xs mt-1">
            You&apos;ll be notified about transaction updates
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <p className="text-rowan-muted text-xs font-medium mb-2">{date}</p>
              <div className="space-y-1">
                {items.map((item) => (
                  <NotificationItem
                    key={item.id}
                    notification={item}
                    onTap={() => {
                      if (!item.readAt) markRead([item.id])
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full text-rowan-yellow text-sm py-3 min-h-11"
            >
              Load More
            </button>
          )}
        </div>
      )}
    </div>
  )
}
