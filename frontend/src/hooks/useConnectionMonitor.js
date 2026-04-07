import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useToast } from './useToast';

/**
 * useConnectionMonitor — track socket connection status and show toasts.
 * Use this hook in any component that should display connection alerts.
 */
export function useConnectionMonitor() {
  const { isConnected } = useSocket();
  const { warning: warningToast, success: successToast, info: infoToast } = useToast();
  const wasConnected = useRef(isConnected);
  const alertShown = useRef(null);

  useEffect(() => {
    // Transition: connected → disconnected
    if (wasConnected.current && !isConnected) {
      warningToast('Connection Lost', 'Real-time updates paused', 0); // No auto-dismiss
      alertShown.current = 'disconnected';
    }
    // Transition: disconnected → connected
    else if (!wasConnected.current && isConnected) {
      if (alertShown.current === 'disconnected') {
        successToast('Connection Restored', 'Real-time updates resumed');
      }
      alertShown.current = null;
    }

    wasConnected.current = isConnected;
  }, [isConnected, warningToast, successToast]);

  return { isConnected };
}
