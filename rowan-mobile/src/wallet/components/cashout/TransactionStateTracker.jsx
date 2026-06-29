import {
  CircleDot, Lock, UserCheck, Banknote, CircleCheckBig,
  Check,
} from 'lucide-react'
import { STATE_ORDER, STATE_SUBTITLES, TX_STATES } from '../../utils/constants'
import { getStatusLabel } from '../../utils/p2pFormat'
import { formatDateTime } from '../../utils/format'

const STATE_ICONS = {
  QUOTE_CONFIRMED: CircleDot,
  ESCROW_LOCKED: Lock,
  TRADER_MATCHED: UserCheck,
  FIAT_PAYOUT_SUBMITTED: Banknote,
  USER_CONFIRMATION_PENDING: UserCheck,
  COMPLETE: CircleCheckBig,
}

/**
 * Vertical timeline tracking transaction state progression.
 */
export default function TransactionStateTracker({ currentState, timestamps }) {
  const flowStates = STATE_ORDER.filter((s) =>
    !['DISPUTE_OPENED', 'DISPUTE_RELEASE_PENDING', 'DISPUTE_REFUND_PENDING'].includes(s)
  )
  const currentIdx = flowStates.indexOf(currentState)
  const isDispute = ['DISPUTE_OPENED', 'DISPUTE_RELEASE_PENDING', 'DISPUTE_REFUND_PENDING'].includes(currentState)

  return (
    <div className="space-y-0">
      {isDispute && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-3 mb-4 text-center">
          <p className="text-rowan-red text-sm font-medium">{getStatusLabel(currentState)}</p>
          <p className="text-rowan-muted text-xs mt-1">{STATE_SUBTITLES[currentState]}</p>
        </div>
      )}
      {flowStates.map((state, idx) => {
        const Icon = STATE_ICONS[state] || CircleDot
        const isCompleted = idx < currentIdx
        const isCurrent = idx === currentIdx
        const isFuture = idx > currentIdx

        return (
          <div key={state}>
            <div className="flex items-start gap-4">
              {/* Icon circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCompleted
                      ? 'bg-rowan-green'
                      : isCurrent
                      ? 'bg-rowan-yellow/20 border-2 border-rowan-yellow animate-pulse-dot'
                      : 'bg-rowan-surface border border-rowan-border'
                  }`}
                >
                  {isCompleted ? (
                    <Check size={18} className="text-white" />
                  ) : (
                    <Icon
                      size={18}
                      className={isCurrent ? 'text-rowan-yellow' : 'text-rowan-muted'}
                    />
                  )}
                </div>
              </div>

              {/* State label */}
              <div className="flex-1 pb-2">
                <p className={`text-sm font-medium ${
                  isCompleted ? 'text-rowan-green' : isCurrent ? 'text-rowan-text' : 'text-rowan-muted'
                }`}>
                  {TX_STATES[state]?.label || getStatusLabel(state)}
                </p>
                <p className="text-rowan-muted text-xs">
                  {STATE_SUBTITLES[state]}
                </p>
                {timestamps?.[state] && (
                  <p className="text-rowan-muted text-xs mt-0.5">
                    {formatDateTime(timestamps[state])}
                  </p>
                )}
              </div>
            </div>

            {/* Connector line */}
            {idx < flowStates.length - 1 && (
              <div className="flex items-start gap-4">
                <div className="flex justify-center w-10">
                  <div
                    className={`w-0.5 h-8 ${
                      isCompleted ? 'bg-rowan-green' : 'bg-rowan-border'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
