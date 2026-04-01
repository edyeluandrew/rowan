import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { adminLogin, adminLogout } from '../services/api/auth'
import { setClientToken, setClientLogout } from '../services/client'

const AuthContext = createContext(null)

/** Registry of callbacks to run on logout (e.g. socket disconnect). */
const _logoutCallbacks = new Set()
export function onAdminLogout(cb) {
  _logoutCallbacks.add(cb)
  return () => _logoutCallbacks.delete(cb)
}

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [token, setToken] = useState(null)
  // No sessionStorage — page refresh sends admin to /login by design

  const login = useCallback(async (email, password) => {
    const data = await adminLogin(email, password)
    const t = data.token
    const a = data.admin
    setToken(t)
    setClientToken(t)
    setAdmin(a)
    return a
  }, [])

  const logout = useCallback(async () => {
    try { await adminLogout() } catch { /* ignore */ }
    _logoutCallbacks.forEach((cb) => { try { cb() } catch { /* noop */ } })
    setToken(null)
    setAdmin(null)
    setClientToken(null)
  }, [])

  // Wire up 401 interceptor → logout
  useEffect(() => { setClientLogout(logout) }, [logout])

  const isAuthenticated = !!token && !!admin

  return (
    <AuthContext.Provider value={{ admin, token, isAuthenticated, isLoading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
