import axios from 'axios'
import { clearAllSecure } from '../utils/storage'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

let _token = null

export function setClientToken(token) {
  _token = token
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
