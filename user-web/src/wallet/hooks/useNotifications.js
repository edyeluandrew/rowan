import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useSocketHook from './useSocket'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  markAllNotificationsRead,
} from '../api/user'

function normalizeNotification(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    transactionId: n.transactionId ?? n.transaction_id,
    readAt: n.readAt ?? n.read_at,
    createdAt: n.createdAt ?? n.created_at,
  }
}

/**
 * Hook to fetch and manage user notifications.
 */
export default function useNotifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationCount()
      setUnreadCount(count)
    } catch {
      /* non-critical */
    }
  }, [])

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    setLoading(true)
    try {
      const data = await getNotifications({ page: pageNum, limit: 20 })
      const items = (Array.isArray(data?.notifications) ? data.notifications : [])
        .map(normalizeNotification)
      if (append) {
        setNotifications((prev) => [...prev, ...items])
      } else {
        setNotifications(items)
      }
      setHasMore(items.length === 20)
      setPage(pageNum)
      if (!append) {
        await fetchUnreadCount()
      }
    } catch {
      /* initial fetch failed — empty list shown */
    } finally {
      setLoading(false)
    }
  }, [fetchUnreadCount])

  useEffect(() => {
    fetchNotifications(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount])

  useSocketHook('new_notification', (notif) => {
    const item = normalizeNotification(notif)
    setNotifications((prev) => {
      if (prev.some((n) => n.id === item.id)) return prev
      return [item, ...prev]
    })
    setUnreadCount((c) => c + 1)
  })

  const markRead = useCallback(async (ids) => {
    try {
      await markNotificationsRead(ids)
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n))
      )
      setUnreadCount((c) => Math.max(0, c - ids.length))
    } catch {
      /* mark-read non-critical */
    }
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch {
      /* mark-all-read non-critical */
    }
  }, [])

  const handleTap = useCallback(async (notification) => {
    if (!notification.readAt) {
      await markRead([notification.id])
    }
    if (notification.transactionId) {
      navigate(`/wallet/transaction/${notification.transactionId}`)
    }
  }, [markRead, navigate])

  const loadMore = useCallback(() => {
    if (hasMore && !loading) fetchNotifications(page + 1, true)
  }, [fetchNotifications, page, hasMore, loading])

  const refresh = useCallback(() => fetchNotifications(1), [fetchNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
    refresh,
    handleTap,
  }
}
