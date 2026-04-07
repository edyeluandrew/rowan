import { useToastContext } from '../../context/ToastContext';
import Toast from './Toast';

/**
 * ToastContainer — renders all toast notifications in a stack.
 * Place this component at the root of your app (inside ToastProvider).
 */
export default function ToastContainer() {
  const { toasts, dismiss } = useToastContext();

  // Only show top 4 toasts to avoid overwhelming the user
  const visibleToasts = toasts.slice(0, 4);

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <div className="pointer-events-auto space-y-2">
        {visibleToasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </div>
  );
}
