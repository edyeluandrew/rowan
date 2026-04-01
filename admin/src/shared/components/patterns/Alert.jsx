/**
 * Standardized Alert Component Pattern
 * Provides consistent alert/notification styling
 */

import React from 'react'
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react'

const alertTypes = {
  error: {
    icon: AlertCircle,
    bgClass: 'bg-rowan-red/10',
    borderClass: 'border-rowan-red/30',
    textClass: 'text-rowan-red',
    iconClass: 'text-rowan-red',
  },
  success: {
    icon: CheckCircle,
    bgClass: 'bg-rowan-green/10',
    borderClass: 'border-rowan-green/30',
    textClass: 'text-rowan-green',
    iconClass: 'text-rowan-green',
  },
  info: {
    icon: Info,
    bgClass: 'bg-rowan-blue/10',
    borderClass: 'border-rowan-blue/30',
    textClass: 'text-rowan-blue',
    iconClass: 'text-rowan-blue',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-rowan-orange/10',
    borderClass: 'border-rowan-orange/30',
    textClass: 'text-rowan-orange',
    iconClass: 'text-rowan-orange',
  },
}

export const Alert = ({ type = 'info', title, message, onClose, className = '' }) => {
  const config = alertTypes[type]
  const Icon = config.icon

  return (
    <div
      className={`${config.bgClass} border ${config.borderClass} rounded-lg p-4 flex gap-3 ${className}`}
      role="alert"
    >
      <Icon className={`${config.iconClass} flex-shrink-0 mt-0.5`} size={20} />
      <div className="flex-1">
        {title && <p className={`${config.textClass} font-semibold`}>{title}</p>}
        {message && <p className={`${config.textClass} text-sm`}>{message}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className={`${config.iconClass} hover:opacity-70`}>
          <X size={20} />
        </button>
      )}
    </div>
  )
}

export default Alert
