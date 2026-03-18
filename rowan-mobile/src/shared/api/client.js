import axios from 'axios';

/** Module-level token — updated via setClientToken() */
let _token = null;

/** Module-level logout callback */
let _onLogout = null;

/** Call after login and on app boot to keep the header in sync. */
export function setClientToken(token) {
  _token = token;
}

/** Register a callback invoked on 401 — used by AuthContext to clear state. */
export function onLogout(callback) {
  _onLogout = callback;
  // Return an unregister function for cleanup
  return () => {
    _onLogout = null;
  };
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

console.log('[Client] BaseURL:', import.meta.env.VITE_API_URL || '(undefined)');
console.log('[Client] Environment variables:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_HOME_DOMAIN: import.meta.env.VITE_HOME_DOMAIN,
  VITE_STELLAR_NETWORK: import.meta.env.VITE_STELLAR_NETWORK,
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
      if (_onLogout) _onLogout();
    }
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Request failed';
    return Promise.reject(new Error(msg));
  }
);

export default client;
