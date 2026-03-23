import { LocalNotifications } from '@capacitor/local-notifications'
import { ROWAN_YELLOW_HEX } from './constants'

/**
 * Request permission to show local notifications.
 */
export async function requestNotificationPermission() {
  try {
    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  } catch {
    return false
  }
}

/**
 * Schedule a local notification that fires almost immediately.
 */
export async function scheduleLocalNotification({ id, title, body, data }) {
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title,
        body,
        schedule: { at: new Date(Date.now() + 100) },
        extra: data,
        channelId: 'rowan-transactions',
        smallIcon: 'ic_notification',
        iconColor: ROWAN_YELLOW_HEX,
      }],
    })
  } catch {
    /* Local notifications not available — silent fail */
  }
}

/**
 * Create the Android notification channel for transaction updates.
 */
export async function createNotificationChannel() {
  try {
    await LocalNotifications.createChannel({
      id: 'rowan-transactions',
      name: 'Transaction Updates',
      description: 'Notifications for cashout transactions',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'default',
    })
  } catch {
    /* channel creation not available — silent fail */
  }
}
