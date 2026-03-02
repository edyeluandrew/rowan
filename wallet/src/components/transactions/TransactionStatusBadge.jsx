import {
  CircleDashed, CircleDot, Lock, UserCheck, Banknote,
  CircleCheckBig, RotateCcw, CircleX, ShieldAlert,
} from 'lucide-react'
import { TX_STATES } from '../../utils/constants'

const ICON_MAP = {
  CircleDashed,
  CircleDot,
  Lock,
  UserCheck,
  Banknote,
  CircleCheckBig,
  RotateCcw,
  CircleX,
  ShieldAlert,
}

const COLOR_MAP = {
  QUOTE_REQUESTED: 'text-rowan-muted bg-rowan-surface',
  QUOTE_CONFIRMED: 'text-rowan-muted bg-rowan-surface',
  ESCROW_LOCKED:   'text-rowan-yellow bg-rowan-yellow/10',
  TRADER_MATCHED:  'text-rowan-yellow bg-rowan-yellow/10',
  FIAT_SENT:       'text-rowan-green bg-rowan-green/10',
  COMPLETE:        'text-rowan-green bg-rowan-green/10',
  REFUNDED:        'text-rowan-yellow bg-rowan-yellow/10',
  FAILED:          'text-rowan-red bg-rowan-red/10',
  DISPUTED:        'text-rowan-red bg-rowan-red/10',
}

/**
 * Status badge with icon mapping to TX_STATES.
 */
export default function TransactionStatusBadge({ state, className = '' }) {
  const stateInfo = TX_STATES[state] || { label: state, icon: 'CircleDashed' }
  const Icon = ICON_MAP[stateInfo.icon] || CircleDashed
  const colors = COLOR_MAP[state] || 'text-rowan-muted bg-rowan-surface'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${colors} ${className}`}
    >
      <Icon size={12} />
      {stateInfo.label}
    </span>
  )
}
