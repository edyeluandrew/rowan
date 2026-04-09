import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginTrader } from '../api/auth';
import { setClientToken } from '../api/client';
import {
  getSecure, setSecure, clearAllSecure,
} from '../utils/storage';
import { clearPreferences } from '../utils/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [trader, setTrader] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ── Bootstrap: check secure storage on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const t = await getSecure('rowan_trader_token');
        const p = await getSecure('rowan_trader_profile');
        if (t && p) {
          setClientToken(t);
          setToken(t);
          setTrader(JSON.parse(p));
          setIsAuthenticated(true);
        }
      } catch {
        /* treat as unauthenticated */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginTrader(email, password);
    const jwt = data.token;
    const profile = data.trader;

    await setSecure('rowan_trader_token', jwt);
    await setSecure('rowan_trader_profile', JSON.stringify(profile));
    await setSecure('rowan_trader_id', String(profile.id));
    if (profile.stellar_address) {
      await setSecure('rowan_stellar_address', profile.stellar_address);
    }

    setClientToken(jwt);
    setToken(jwt);
    setTrader(profile);
    setIsAuthenticated(true);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    await clearAllSecure();
    await clearPreferences();
    setClientToken(null);
    setToken(null);
    setTrader(null);
    setIsAuthenticated(false);
  }, []);

  const setTokenDirect = useCallback(async (jwt) => {
    await setSecure('rowan_trader_token', jwt);
    setClientToken(jwt);
    setToken(jwt);
  }, []);

  const setTraderDirect = useCallback(async (profile) => {
    await setSecure('rowan_trader_profile', JSON.stringify(profile));
    await setSecure('rowan_trader_id', String(profile.id));
    if (profile.stellar_address) {
      await setSecure('rowan_stellar_address', profile.stellar_address);
    }
    setTrader(profile);
    setIsAuthenticated(true);
  }, []);

  return (
    <AuthContext.Provider value={{ trader, token, isAuthenticated, loading, login, logout, setToken: setTokenDirect, setTrader: setTraderDirect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
