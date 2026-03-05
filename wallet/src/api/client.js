import axios from 'axios'
import { clearAllSecure } from '../utils/storage'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

let _token = null
const _logoutCallbacks = new Set()

export function setClientToken(token) {
  _token = token
}

/** Register a callback to run on 401 logout (e.g. socket disconnect). */
export function onLogout(cb) {
  _logoutCallbacks.add(cb)
  return () => _logoutCallbacks.delete(cb)
}

client.interceptors.request.use((config) => {
  if (_token) {
    config.headers.Authorization = `Bearer ${_token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      _token = null
      _logoutCallbacks.forEach((cb) => { try { cb() } catch { /* noop */ } })
      await clearAllSecure()
      window.location.replace('/onboarding')
    }
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong'
    throw new Error(message)
  }
)

export default client
