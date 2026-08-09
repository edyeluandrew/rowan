import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LocalNotifications } from '@capacitor/local-notifications'
import { requestNotificationPermission, createNotificationChannel } from '../utils/notifications'
import { getPreference, setPreference } from '../utils/storage'
import { resolveNotificationPath } from '../utils/notificationRoutes'

/**
 * Hook to manage push notification permissions and deep-link taps.
 * Web ignores LocalNotifications; path resolution still used by in-app list.
 */
export default function usePushNotifications() {
  const navigate = useNavigate()
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const initialised = useRef(false)
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const openFromExtra = useCallback((extra) => {
    if (!extra || typeof extra !== 'object') return
    const path = resolveNotificationPath(extra)
    if (path) {
      navigateRef.current(path)
    }
  }, [])

  const initialize = useCallback(async () => {
    if (initialised.current) return
    initialised.current = true

    try {
      await createNotificationChannel()
    } catch {
      /* channel creation can fail on web */
    }

    try {
      const wasDismissed = await getPreference('rowan_push_banner_dismissed')
      setDismissed(wasDismissed === 'true')
    } catch {
      setDismissed(false)
    }

    try {
      const perm = await LocalNotifications.checkPermissions()
      setPermissionGranted(perm.display === 'granted')
    } catch {
      /* web fallback */
    }

    try {
      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        openFromExtra(event?.notification?.extra)
      })
    } catch {
      /* not available on web */
    }
  }, [openFromExtra])

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission()
    setPermissionGranted(granted)
    if (granted) {
      setDismissed(true)
      await setPreference('rowan_push_banner_dismissed', 'true')
    }
    return granted
  }, [])

  const dismissBanner = useCallback(async () => {
    setDismissed(true)
    await setPreference('rowan_push_banner_dismissed', 'true')
  }, [])

  return { permissionGranted, dismissed, initialize, requestPermission, dismissBanner }
}
