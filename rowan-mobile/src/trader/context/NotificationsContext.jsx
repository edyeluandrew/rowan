import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  markAllNotificationsRead,
} from '../api/notifications';

const NotificationsContext = createContext(null);

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

function parseUnreadCount(raw) {
  if (typeof raw === 'number') return raw;
  if (raw == null) return 0;
  if (typeof raw === 'object') {
    const n = Number(raw.count ?? raw.unread ?? raw.unreadCount ?? 0);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Shared notification state so Home / BottomNav / Notifications stay in sync.
 */
export function NotificationsProvider({ children }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { on, off } = useSocket();
  const mountedRef = useRef(true);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = parseUnreadCount(await getUnreadNotificationCount());
      if (mountedRef.current) setUnreadCount(count);
      return count;
    } catch {
      return null;
    }
  }, []);

  const fetch = useCallback(async () => {
    try {
      const data = await getNotifications(1, 50);
      const list = (data.notifications || data || []).map(normalizeNotification);
      if (mountedRef.current) {
        setNotifications(list);
        const fromList = list.filter((n) => !n.readAt).length;
        const serverCount = await fetchUnreadCount();
        if (mountedRef.current && serverCount == null) {
          setUnreadCount(fromList);
        }
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
      if (!item.readAt) {
        setUnreadCount((c) => c + 1);
      }
    };
    on('new_notification', handler);
    return () => off('new_notification', handler);
  }, [on, off]);

  const markRead = useCallback(async (ids) => {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) return;
    try {
      await markNotificationsRead(unique);
      setNotifications((prev) =>
        prev.map((n) => (unique.includes(n.id) ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)),
      );
      await fetchUnreadCount();
    } catch {
      await fetchUnreadCount();
    }
  }, [fetchUnreadCount]);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
      );
      setUnreadCount(0);
      // Confirm with server so badge cannot stick after a partial failure
      const remaining = await fetchUnreadCount();
      if (remaining != null && remaining > 0) {
        setUnreadCount(remaining);
      } else {
        setUnreadCount(0);
      }
    } catch {
      await fetchUnreadCount();
    }
  }, [fetchUnreadCount]);

  const handleTap = useCallback(async (notification) => {
    if (!notification.readAt) {
      await markRead([notification.id]);
    }
    if (notification.transactionId) {
      navigate(`/trader/requests/${notification.transactionId}`);
    }
  }, [markRead, navigate]);

  const value = {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    isLoading,
    refetch: fetch,
    handleTap,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return ctx;
}
