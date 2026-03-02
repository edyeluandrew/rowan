import {
  Coins,
  Inbox,
  ShieldAlert,
  Key,
  Bell,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { formatTimeAgo } from '../../utils/format';

const iconMap = {
  payout: { Icon: Coins, color: 'text-rowan-yellow' },
  new_request: { Icon: Inbox, color: 'text-rowan-yellow' },
  request: { Icon: Inbox, color: 'text-rowan-yellow' },
  dispute: { Icon: ShieldAlert, color: 'text-rowan-red' },
  escrow: { Icon: Key, color: 'text-rowan-yellow' },
  system: { Icon: Bell, color: 'text-rowan-muted' },
  verification: { Icon: ShieldCheck, color: 'text-rowan-green' },
};

/**
 * NotificationItem — single notification row.
 * Props: notification, onTap(notification)
 */
export default function NotificationItem({ notification, onTap }) {
  const n = notification;
  const isUnread = !n.read && !n.read_at;
  const { Icon, color } = iconMap[n.type] || iconMap.system;

  return (
    <button
      onClick={() => onTap?.(n)}
      className="px-4 py-4 border-b border-rowan-border flex items-start gap-3 w-full text-left active:bg-rowan-surface/60 transition-colors"
    >
      {/* Unread dot */}
      <div className="pt-1.5 flex-shrink-0 w-2">
        {isUnread && <div className="w-2 h-2 rounded-full bg-rowan-yellow" />}
      </div>

      {/* Icon */}
      <div className="w-9 h-9 rounded-full bg-rowan-surface border border-rowan-border flex items-center justify-center flex-shrink-0">
        <Icon size={18} className={color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-rowan-text text-sm ${isUnread ? 'font-bold' : 'font-medium'} truncate`}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-rowan-muted text-xs mt-0.5 leading-relaxed line-clamp-2">
            {n.body}
          </p>
        )}
        <p className="text-rowan-muted text-xs mt-1">
          {formatTimeAgo(n.created_at || n.createdAt)}
        </p>
      </div>
    </button>
  );
}
