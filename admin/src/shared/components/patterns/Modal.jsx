/**
 * Standardized Modal Component Pattern
 * Provides consistent modal/dialog rendering with backdrop, animations
 */

import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export const Modal = ({ open, onClose, title, children, actions, size = 'md', closeOnEscape = true }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (closeOnEscape && e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, closeOnEscape, onClose])

  if (!open) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-white rounded-lg shadow-lg ${sizeClasses[size]} w-full mx-4`}>
        <div className="flex items-center justify-between p-4 border-b border-rowan-border">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {actions && <div className="flex justify-end gap-2 p-4 border-t border-rowan-border">{actions}</div>}
      </div>
    </div>
  )
}

export default Modal
