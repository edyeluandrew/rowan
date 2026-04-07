import { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const typeConfig = {
  success: {
    bg: 'bg-rowan-green/10',
    border: 'border-rowan-green/30',
    text: 'text-rowan-green',
    icon: CheckCircle2,
  },
  error: {
    bg: 'bg-rowan-red/10',
    border: 'border-rowan-red/30',
    text: 'text-rowan-red',
    icon: AlertCircle,
  },
  warning: {
    bg: 'bg-rowan-yellow/10',
    border: 'border-rowan-yellow/30',
    text: 'text-rowan-yellow',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: Info,
  },
};

/**
 * Toast — individual toast notification component.
 */
export default function Toast({ toast, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);
  const config = typeConfig[toast.type] || typeConfig.info;
  const Icon = config.icon;

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  };

  useEffect(() => {
    // Auto-dismiss can be called from context, but also handle manually
    // This is just for safety
    return () => {};
  }, [toast.id]);

  return (
    <div
      className={`
        transform transition-all duration-200 ease-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
    >
      <div
        className={`
          ${config.bg} ${config.border}
          rounded-lg border p-4 mb-2
          flex items-start gap-3
          max-w-md
          shadow-lg
        `}
      >
        <Icon size={20} className={`${config.text} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className={`${config.text} font-semibold text-sm`}>
              {toast.title}
            </p>
          )}
          {toast.message && (
            <p className="text-rowan-muted text-sm">
              {toast.message}
            </p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className={`${config.text} hover:opacity-80 transition-opacity flex-shrink-0 mt-0.5`}
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
