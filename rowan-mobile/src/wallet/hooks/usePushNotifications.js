import { useEffect, useRef, useCallback, useState } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import { requestNotificationPermission, createNotificationChannel } from '../utils/notifications'
import { getPreference, setPreference } from '../utils/storage'

/**
 * Hook to manage push notification permissions and lifecycle.
 */
export default function usePushNotifications() {
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const initialised = useRef(false)

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
      /* web fallback — always false */
    }
  }, [])

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
