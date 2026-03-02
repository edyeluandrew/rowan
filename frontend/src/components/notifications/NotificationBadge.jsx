/**
 * NotificationBadge — small red count badge absolute-positioned.
 * Props: count (number)
 */
export default function NotificationBadge({ count }) {
  if (!count || count <= 0) return null;
  const display = count > 99 ? '99+' : String(count);

  return (
    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rowan-red flex items-center justify-center text-white text-[9px] font-bold leading-none">
      {display}
    </span>
  );
}
