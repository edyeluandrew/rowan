import { useToastContext } from '../context/ToastContext';

/**
 * useToast — trigger toast notifications from any component.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast({ type: 'success', title: 'Success', message: 'Action completed' });
 */
export function useToast() {
  const { showToast, dismiss, clear } = useToastContext();

  const success = (title, message, duration = 4000) =>
    showToast({ type: 'success', title, message, duration });

  const error = (title, message, duration = 5000) =>
    showToast({ type: 'error', title, message, duration });

  const warning = (title, message, duration = 4000) =>
    showToast({ type: 'warning', title, message, duration });

  const info = (title, message, duration = 3000) =>
    showToast({ type: 'info', title, message, duration });

  return { showToast, success, error, warning, info, dismiss, clear };
}
