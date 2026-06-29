import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  markAllNotificationsRead,
} from '../api/notifications';

function normalizeNotification(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    transactionId: n.transactionId ?? n.transaction_id,
    readAt: n.readAt ?? n.read_at,
    createdAt: n.createdAt ?? n.created_at,
  };
}

/**
 * useNotifications — fetch notifications, track unread count, listen to WS.
 */
export function useNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { on, off } = useSocket();
  const mountedRef = useRef(true);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationCount();
      if (mountedRef.current) setUnreadCount(count);
    } catch {
      /* non-critical */
    }
  }, []);

  const fetch = useCallback(async () => {
    try {
      const data = await getNotifications(1, 50);
      const list = (data.notifications || data || []).map(normalizeNotification);
      if (mountedRef.current) {
        setNotifications(list);
        await fetchUnreadCount();
      }
    } catch {
      /* initial fetch failed */
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [fetchUnreadCount]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  useEffect(() => {
    const handler = (notif) => {
      const item = normalizeNotification(notif);
      setNotifications((prev) => {
        if (prev.some((n) => n.id === item.id)) return prev;
        return [item, ...prev];
      });
      setUnreadCount((c) => c + 1);
    };
    on('new_notification', handler);
    return () => off('new_notification', handler);
  }, [on, off]);

  const markRead = useCallback(async (ids) => {
    try {
      await markNotificationsRead(ids);
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - ids.length));
    } catch {
      /* non-critical */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      /* non-critical */
    }
  }, []);

  const handleTap = useCallback(async (notification) => {
    if (!notification.readAt) {
      await markRead([notification.id]);
    }
    if (notification.transactionId) {
      navigate(`/trader/requests/${notification.transactionId}`);
    }
  }, [markRead, navigate]);

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    isLoading,
    refetch: fetch,
    handleTap,
  };
}
