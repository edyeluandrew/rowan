import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Slide-up bottom sheet modal.
 */
export default function BottomSheet({ open, onClose, title, children }) {
  const backdropRef = useRef(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/70 z-50 flex items-end"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="bg-rowan-surface rounded-t-2xl p-6 w-full animate-slide-up max-h-[85vh] overflow-y-auto">
        <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-rowan-text font-bold text-lg">{title}</h3>}
          <button onClick={onClose} className="text-rowan-muted p-1">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
