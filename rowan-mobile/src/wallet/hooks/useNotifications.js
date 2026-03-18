import { useState, useEffect, useCallback } from 'react'
import { getNotifications, markNotificationsRead, markAllNotificationsRead } from '../api/user'

/**
 * Hook to fetch and manage user notifications.
 */
export default function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    setLoading(true)
    try {
      const data = await getNotifications({ page: pageNum, limit: 20 })
      const items = Array.isArray(data?.notifications) ? data.notifications : Array.isArray(data) ? data : []
      if (append) {
        setNotifications((prev) => [...prev, ...items])
      } else {
        setNotifications(items)
      }
      setHasMore(items.length === 20)
      setPage(pageNum)
      setUnreadCount((prev) => items.filter((n) => !n.readAt).length + (append ? prev : 0))
    } catch {
      /* initial fetch failed — empty list shown */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const loadMore = useCallback(() => {
    if (hasMore && !loading) fetchNotifications(page + 1, true)
  }, [fetchNotifications, page, hasMore, loading])

  const refresh = useCallback(() => fetchNotifications(1), [fetchNotifications])

  return { notifications, unreadCount, loading, hasMore, loadMore, markRead, markAllRead, refresh }
}
