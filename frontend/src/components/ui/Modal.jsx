import { X } from 'lucide-react';

/**
 * Modal — Reusable modal dialog component
 */
export default function Modal({ title, children, onClose, actions }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-rowan-card border border-rowan-border rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-rowan-border">
          <h2 className="text-rowan-text font-semibold text-lg">{title}</h2>
          <button onClick={onClose} className="text-rowan-muted hover:text-rowan-text">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-rowan-border">{actions}</div>
      </div>
    </div>
  );
}
