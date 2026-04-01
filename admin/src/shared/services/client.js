import axios from 'axios'
import { API_TIMEOUT } from '../utils/constants'

// Get API URL from environment, handling both Vite and test environments
const getApiUrl = () => {
  try {
    // For Vite/browser environment
    if (import.meta && import.meta.env && import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL
    }
  } catch {
    // Fallback for Node/test environment
  }
  // For test/Node environment or fallback
  try {
    // eslint-disable-next-line no-undef
    return process.env.VITE_API_URL || 'http://localhost:3000'
  } catch {
    return 'http://localhost:3000'
  }
}

let _token = null
let _logoutFn = null
export const setClientToken = (token) => { _token = token }
export const getClientToken = () => _token
export const setClientLogout = (fn) => { _logoutFn = fn }

const client = axios.create({
  baseURL: getApiUrl(),
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`
  return config
})

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      _token = null
      if (_logoutFn) _logoutFn()
    }
    const message = err.response?.data?.message || err.message || 'Request failed'
    return Promise.reject(new Error(message))
  }
)

export default client
