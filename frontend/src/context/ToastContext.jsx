import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

/**
 * ToastProvider — manages global toast notifications.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const showToast = useCallback(({
    type = 'info',
    title = '',
    message = '',
    duration = 4000,
  }) => {
    const id = ++toastId;
    const toast = {
      id,
      type,
      title,
      message,
      duration,
    };

    setToasts((prev) => [toast, ...prev]);

    // Auto-dismiss after duration
    if (duration > 0) {
      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);
      timersRef.current[id] = timer;
    }

    return id;
  }, []);

  const dismiss = useCallback((id) => {
    // Clear timer if exists
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    // Remove toast
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => {
    // Clear all timers
    Object.values(timersRef.current).forEach((t) => clearTimeout(t));
    timersRef.current = {};
    // Clear all toasts
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismiss, clear }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastContext must be inside ToastProvider');
  return ctx;
}
