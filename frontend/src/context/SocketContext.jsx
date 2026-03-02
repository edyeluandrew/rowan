import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getPreference } from '../utils/storage';
import { SOCKET_RECONNECT_ATTEMPTS } from '../utils/constants';

const SocketContext = createContext(null);

/** Play a short 800 Hz ping via Web Audio API */
function playPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* ignore on platforms without AudioContext */ }
}

export function SocketProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const s = io(import.meta.env.VITE_API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: SOCKET_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
    });

    socketRef.current = s;

    s.on('connect', () => {
      setIsConnected(true);
      retryRef.current = 0;
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('connect_error', () => {
      retryRef.current += 1;
      if (retryRef.current >= SOCKET_RECONNECT_ATTEMPTS) {
        setIsConnected(false);
      }
    });

    /* ── new_request → sound + vibration ── */
    s.on('new_request', async () => {
      const soundEnabled = await getPreference('rowan_sound_enabled', 'true');
      if (soundEnabled === 'true') playPing();

      const vibEnabled = await getPreference('rowan_vibration_enabled', 'true');
      if (vibEnabled === 'true' && navigator.vibrate) {
        navigator.vibrate([200]);
      }
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, token]);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, on, off }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be inside SocketProvider');
  return ctx;
}
