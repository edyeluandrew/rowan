import axios from 'axios';
import { API_TIMEOUT } from '../utils/constants';
import { clearAllSecure } from '../utils/storage';

/** Module-level token — updated via setClientToken() */
let _token = null;

/** Call after login and on app boot to keep the header in sync. */
export function setClientToken(token) {
  _token = token;
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

/* ── Request interceptor: attach Bearer token ── */
client.interceptors.request.use((config) => {
  if (_token) {
    config.headers.Authorization = `Bearer ${_token}`;
  }
  return config;
});

/* ── Response interceptor: handle 401 globally ── */
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      _token = null;
      await clearAllSecure();
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export default client;
