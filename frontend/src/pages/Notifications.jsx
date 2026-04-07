import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, BellDot } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { getNotifications } from '../api/notifications';
import NotificationItem from '../components/notifications/NotificationItem';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDate } from '../utils/format';

/**
 * Group notifications by date: Today, Yesterday, DD MMM YYYY.
 */
function groupByDate(notifications) {
  const groups = [];
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  let currentLabel = null;
  let currentGroup = [];

  notifications.forEach((n) => {
    const d = new Date(n.created_at || n.createdAt);
    const ds = d.toDateString();
    let label;
    if (ds === todayStr) label = 'Today';
    else if (ds === yesterdayStr) label = 'Yesterday';
    else label = formatDate(n.created_at || n.createdAt);

    if (label !== currentLabel) {
      if (currentGroup.length) groups.push({ label: currentLabel, items: currentGroup });
      currentLabel = label;
      currentGroup = [n];
    } else {
      currentGroup.push(n);
    }
  });
  if (currentGroup.length) groups.push({ label: currentLabel, items: currentGroup });
  return groups;
}

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, isLoading } = useNotifications();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [page, setPage] = useState(1);
  const [allNotifs, setAllNotifs] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  /* Sync hook-loaded data */
  useEffect(() => {
    setAllNotifs(notifications);
  }, [notifications]);

  const filtered = filter === 'unread'
    ? allNotifs.filter((n) => !n.read && !n.read_at)
    : allNotifs;

  const groups = groupByDate(filtered);

  const handleTap = (n) => {
    markRead([n.id]);
    // Navigate to dispute if it's a dispute notification
    if (n.linkedDisputeId || n.dispute_id) {
      navigate(`/disputes/${n.linkedDisputeId || n.dispute_id}`);
    }
    // Navigate to request/transaction
    else if (n.linkedTransactionId || n.transaction_id) {
      navigate(`/requests/${n.linkedTransactionId || n.transaction_id}`);
    }
  };

  const loadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    try {
      const data = await getNotifications(next, 50);
      const list = data.notifications || data || [];
      setAllNotifs((prev) => [...prev, ...list]);
      setHasMore(list.length === 50);
      setPage(next);
    } catch { /* pagination — user can retry */ } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="bg-rowan-bg min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text p-1">
          <ChevronLeft size={22} />
        </button>
        <span className="text-rowan-text font-bold">Notifications</span>
        {unreadCount > 0 ? (
          <button onClick={markAllRead} className="flex items-center gap-1.5 text-rowan-yellow text-sm">
            <CheckCircle2 size={15} />
            <span className="text-xs">Mark all read</span>
          </button>
        ) : <div className="w-10" />}
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-rowan-border">
        {['all', 'unread'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-3 text-sm text-center capitalize ${
              filter === f
                ? 'text-rowan-yellow border-b-2 border-rowan-yellow font-medium'
                : 'text-rowan-muted'
            }`}
          >
            {f === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size={28} className="text-rowan-yellow" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <BellDot size={48} className="text-rowan-muted mb-4" />
          <p className="text-rowan-muted text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="pb-24">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="text-rowan-muted text-xs uppercase tracking-wider py-2 px-4">
                {g.label}
              </p>
              {g.items.map((n) => (
                <NotificationItem key={n.id} notification={n} onTap={handleTap} />
              ))}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 mt-2 text-sm text-rowan-yellow font-medium rounded-xl bg-rowan-surface active:bg-rowan-border transition-colors flex items-center justify-center gap-2 mx-4"
              style={{ width: 'calc(100% - 2rem)' }}
            >
              {loadingMore ? (
                <LoadingSpinner size={16} className="text-rowan-yellow" />
              ) : (
                'Load More'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
