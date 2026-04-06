import { useState } from 'react'
import { RotateCw, AlertCircle } from 'lucide-react'
import Badge from '../../../shared/components/ui/Badge'
import { formatUsdc, formatDateTime, formatAddress } from '../../../shared/utils/format'
import { retryRefund } from '../../../shared/services/api/escrow'

function formatAge(seconds) {
  if (!seconds) return 'N/A'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export default function PendingRefundsTable({ refunds, onRetry }) {
  const [retrying, setRetrying] = useState(null)
  const [retryError, setRetryError] = useState(null)

  const getStateColor = (state) => {
    if (state === 'FAILED') return 'red'
    if (state === 'REFUNDED') return 'green'
    return 'gray'
  }

  const getStateLabel = (state) => {
    if (state === 'FAILED') return 'Failed'
    if (state === 'REFUNDED') return 'Refunded'
    return state
  }

  const handleRetry = async (refundId, reason = 'Retry from admin panel') => {
    try {
      setRetrying(refundId)
      setRetryError(null)
      await retryRefund(refundId, reason)
      if (onRetry) {
        await onRetry()
      }
      setRetrying(null)
    } catch (err) {
      setRetryError(err?.message || 'Failed to retry refund')
      setRetrying(null)
    }
  }

  return (
    <>
      {retryError && (
        <div className="mb-4 bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {retryError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rowan-border text-rowan-muted text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-2 font-medium">TX ID</th>
              <th className="text-left px-4 py-2 font-medium">Amount</th>
              <th className="text-left px-4 py-2 font-medium">State</th>
              <th className="text-left px-4 py-2 font-medium">Reason</th>
              <th className="text-left px-4 py-2 font-medium">Age</th>
              <th className="text-left px-4 py-2 font-medium">Phone Hash</th>
              <th className="text-center px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((refund) => (
              <tr key={refund.id} className="border-b border-rowan-border/50 hover:bg-rowan-bg/30">
                <td className="px-4 py-2 text-sm text-rowan-muted font-mono">
                  {formatAddress(refund.id)}
                </td>
                <td className="px-4 py-2 text-sm text-rowan-text font-bold">
                  {formatUsdc(refund.usdc_amount)} USDC
                </td>
                <td className="px-4 py-2">
                  <Badge variant={getStateColor(refund.state)}>{getStateLabel(refund.state)}</Badge>
                </td>
                <td className="px-4 py-2 text-sm text-rowan-muted max-w-xs truncate">
                  {refund.failure_reason || '-'}
                </td>
                <td className="px-4 py-2 text-sm text-rowan-text whitespace-nowrap">
                  {formatAge(refund.age_seconds)}
                </td>
                <td className="px-4 py-2 text-sm text-rowan-muted font-mono">
                  {refund.phone_hash ? formatAddress(refund.phone_hash) : '-'}
                </td>
                <td className="px-4 py-2 text-center">
                  {refund.state === 'FAILED' && (
                    <button
                      onClick={() => handleRetry(refund.id)}
                      disabled={retrying === refund.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-rowan-yellow/20 text-rowan-yellow hover:bg-rowan-yellow/30 rounded-lg font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCw size={14} />
                      {retrying === refund.id ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                  {refund.state === 'REFUNDED' && refund.stellar_refund_tx && (
                    <span className="text-xs text-rowan-muted font-mono">
                      ✓ {formatAddress(refund.stellar_refund_tx)}
                    </span>
                  )}
                  {refund.state === 'REFUNDED' && !refund.stellar_refund_tx && (
                    <button
                      onClick={() => handleRetry(refund.id)}
                      disabled={retrying === refund.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-rowan-yellow/20 text-rowan-yellow hover:bg-rowan-yellow/30 rounded-lg font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCw size={14} />
                      {retrying === refund.id ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
