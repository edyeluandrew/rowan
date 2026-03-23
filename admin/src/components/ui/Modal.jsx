import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-rowan-surface border border-rowan-border rounded-2xl p-6 w-full ${maxWidth} mx-4 animate-slide-up z-10`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-rowan-text text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-rowan-muted hover:text-rowan-text p-1">
            <X size={18} />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 mt-6">{footer}</div>}
      </div>
    </div>
  )
}
