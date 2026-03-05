import { createContext, useContext } from 'react'
import useNotificationsHook from '../hooks/useNotifications'

const NotificationsContext = createContext(null)

/**
 * Provides shared notification state to the entire app.
 * Wrap inside AuthProvider so the API token is available.
 */
export function NotificationsProvider({ children }) {
  const notifications = useNotificationsHook()
  return (
    <NotificationsContext.Provider value={notifications}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotificationsContext must be used within NotificationsProvider')
  return ctx
}
