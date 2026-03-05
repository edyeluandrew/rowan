import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', loading = false, variant = 'danger', children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-rowan-orange shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-rowan-muted text-sm">{message}</p>
          {children}
        </div>
      </div>
    </Modal>
  )
}
