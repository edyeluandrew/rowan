import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { getNotifications, markNotificationsRead, markAllNotificationsRead } from '../api/notifications';

/**
 * useNotifications — fetch notifications, track unread count, listen to WS.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { on, off } = useSocket();
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    try {
      const data = await getNotifications(1, 50);
      const list = data.notifications || data || [];
      if (mountedRef.current) {
        setNotifications(list);
        setUnreadCount(
          typeof data.unreadCount === 'number'
            ? data.unreadCount
            : list.filter((n) => !n.read && !n.read_at).length,
        );
      }
    } catch { /* initial fetch failed — empty list shown */ } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  /* WebSocket: prepend new notifications */
  useEffect(() => {
    const handler = (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);
    };
    on('notification_new', handler);
    return () => off('notification_new', handler);
  }, [on, off]);

  const markRead = useCallback(async (ids) => {
    try {
      await markNotificationsRead(ids);
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true, read_at: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - ids.length));
    } catch { /* mark-read non-critical */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch { /* mark-all-read non-critical */ }
  }, []);

  return { notifications, unreadCount, markRead, markAllRead, isLoading, refetch: fetch };
}
