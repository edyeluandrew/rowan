/**
 * Modal UI re-export for compatibility
 */
export { Modal } from '../patterns/Modal'

export default function Modal({ open, onClose, title, children, actions }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-rowan-border">
          <h2 className="text-lg font-semibold text-rowan-text">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4">{children}</div>
        {actions && <div className="flex justify-end gap-2 p-4 border-t border-rowan-border">{actions}</div>}
      </div>
    </div>
  )
}
