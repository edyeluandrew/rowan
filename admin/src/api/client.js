import axios from 'axios'
import { API_TIMEOUT } from '../utils/constants'

let _token = null
let _logoutFn = null
export const setClientToken = (token) => { _token = token }
export const getClientToken = () => _token
export const setClientLogout = (fn) => { _logoutFn = fn }

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
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
