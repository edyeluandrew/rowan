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
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
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
