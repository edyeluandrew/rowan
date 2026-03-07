/**
 * Small red badge showing unread notification count.
 */
export default function NotificationBadge({ count }) {
  if (!count || count <= 0) return null

  return (
    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rowan-red rounded-full text-[9px] text-white flex items-center justify-center font-bold">
      {count > 9 ? '9+' : count}
    </span>
  )
}
