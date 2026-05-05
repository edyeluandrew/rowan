import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronLeft, PartyPopper, RotateCcw, XCircle, ShieldCheck, FileText, Clock } from 'lucide-react'
import { getTransactionStatus, confirmReceipt, openDispute } from '../api/cashout'
import useSocketHook from '../hooks/useSocket'
import TransactionStateTracker from '../components/cashout/TransactionStateTracker'
import Button from '../components/ui/Button'

const TERMINAL_STATES = ['COMPLETE', 'REFUNDED', 'FAILED']
const POLL_INTERVAL = 3000 // Poll every 3 seconds while waiting

export default function TransactionStatus() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { stellarTxHash } = location.state || {}
  
  const [transaction, setTransaction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isWaiting, setIsWaiting] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [disputing, setDisputing] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [confirmError, setConfirmError] = useState(null)
  const [disputeError, setDisputeError] = useState(null)

  const MAX_RETRIES_ON_404 = 40 // ~2 minutes (40 × 3 seconds)

  useEffect(() => {
    let cancelled = false
    let pollTimer = null

    const fetch = async () => {
      try {
        const tx = await getTransactionStatus(id)
        if (!cancelled) {
          setTransaction(tx)
          setIsWaiting(false)
          setLoading(false)
          setRetryCount(0) // Reset retries on success

          // ✅ FIX: Keep polling until transaction reaches terminal state
          // so UI stays in sync with backend state changes
          if (!TERMINAL_STATES.includes(tx.state)) {
            console.log(`[TransactionStatus] Tx in state ${tx.state} — polling again in 3s`)
            pollTimer = setTimeout(() => {
              if (!cancelled) {
                fetch() // Poll again
              }
            }, POLL_INTERVAL)
          } else {
            console.log(`[TransactionStatus] Transaction reached terminal state: ${tx.state}`)
          }
        }
      } catch (err) {
        if (!cancelled) {
          // 404 means transaction not yet recorded — this is normal, retry (but with timeout)
          if (err.response?.status === 404) {
            if (retryCount >= MAX_RETRIES_ON_404) {
              // Timeout: give up after ~2 minutes
              setError('Transaction confirmation timeout — check your history or contact support')
              setLoading(false)
              console.log(`[TransactionStatus] Transaction not found after ${retryCount} retries (~2 min)`)
            } else {
              setIsWaiting(true)
              setRetryCount((prev) => prev + 1)
              console.log(`[TransactionStatus] Transaction not yet recorded (attempt ${retryCount + 1}/${MAX_RETRIES_ON_404}), retrying in 3 seconds...`)
              // Schedule next poll
              pollTimer = setTimeout(() => {
                if (!cancelled) {
                  fetch() // Retry
                }
              }, POLL_INTERVAL)
            }
          } else {
            // Real error (not 404)
            setError(err.message)
            setLoading(false)
          }
        }
      }
    }

    fetch()
    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [id])

  const handleConfirmReceipt = async () => {
    setConfirming(true)
    setConfirmError(null)
    try {
      const result = await confirmReceipt(id)
      // Update transaction state
      setTransaction((prev) => (prev ? { ...prev, state: 'COMPLETE', ...result } : prev))
      setShowConfirmModal(false)
    } catch (err) {
      setConfirmError(err.response?.data?.error || err.message || 'Confirmation failed')
    } finally {
      setConfirming(false)
    }
  }

  const handleOpenDispute = async () => {
    if (!disputeReason.trim()) {
      setDisputeError('Please provide a reason for the dispute')
      return
    }
    setDisputing(true)
    setDisputeError(null)
    try {
      const result = await openDispute(id, disputeReason.trim())
      // Update transaction state
      setTransaction((prev) => (prev ? { ...prev, state: 'DISPUTE_OPENED', ...result } : prev))
      setShowDisputeModal(false)
      setDisputeReason('')
    } catch (err) {
      setDisputeError(err.response?.data?.error || err.message || 'Dispute opening failed')
    } finally {
      setDisputing(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    let pollTimer = null

    const fetch = async () => {
      try {
        const tx = await getTransactionStatus(id)
        if (!cancelled) {
          setTransaction(tx)
          setIsWaiting(false)
          setLoading(false)
          setRetryCount(0) // Reset retries on success

          // ✅ FIX: Keep polling until transaction reaches terminal state
          // so UI stays in sync with backend state changes
          if (!TERMINAL_STATES.includes(tx.state)) {
            console.log(`[TransactionStatus] Tx in state ${tx.state} — polling again in 3s`)
            pollTimer = setTimeout(() => {
              if (!cancelled) {
                fetch() // Poll again
              }
            }, POLL_INTERVAL)
          } else {
            console.log(`[TransactionStatus] Transaction reached terminal state: ${tx.state}`)
          }
        }
      } catch (err) {
        if (!cancelled) {
          // 404 means transaction not yet recorded — this is normal, retry (but with timeout)
          if (err.response?.status === 404) {
            if (retryCount >= MAX_RETRIES_ON_404) {
              // Timeout: give up after ~2 minutes
              setError('Transaction confirmation timeout — check your history or contact support')
              setLoading(false)
              console.log(`[TransactionStatus] Transaction not found after ${retryCount} retries (~2 min)`)
            } else {
              setIsWaiting(true)
              setRetryCount((prev) => prev + 1)
              console.log(`[TransactionStatus] Transaction not yet recorded (attempt ${retryCount + 1}/${MAX_RETRIES_ON_404}), retrying in 3 seconds...`)
              // Schedule next poll
              pollTimer = setTimeout(() => {
                if (!cancelled) {
                  fetch() // Retry
                }
              }, POLL_INTERVAL)
            }
          } else {
            // Real error (not 404)
            setError(err.message)
            setLoading(false)
          }
        }
      }
    }

    fetch()
    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [id])
  useSocketHook('transaction_update', (data) => {
    if (data.transactionId === id) {
      setTransaction((prev) => (prev ? { ...prev, ...data } : prev))
    }
  })

  useSocketHook('transaction_complete', (data) => {
    if (data.transactionId === id) {
      setTransaction((prev) => (prev ? { ...prev, state: 'COMPLETE', ...data } : prev))
    }
  })

  useSocketHook('transaction_refunded', (data) => {
    if (data.transactionId === id) {
      setTransaction((prev) => (prev ? { ...prev, state: 'REFUNDED', ...data } : prev))
    }
  })

  useSocketHook('transaction_failed', (data) => {
    if (data.transactionId === id) {
      setTransaction((prev) => (prev ? { ...prev, state: 'FAILED', ...data } : prev))
    }
  })

  const isTerminal = transaction && TERMINAL_STATES.includes(transaction.state)

  const terminalMessage = () => {
    if (!transaction) return ''
    switch (transaction.state) {
      case 'COMPLETE':
        return 'Payment sent successfully! The mobile money transfer has been completed.'
      case 'REFUNDED':
        return 'Your XLM has been safely returned to your wallet. No funds were lost — you can try again whenever you\u0027re ready.'
      case 'FAILED':
        return 'This transaction has failed. Please contact support if you need assistance.'
      default:
        return ''
    }
  }

  const terminalIcon = () => {
    if (!transaction) return null
    switch (transaction.state) {
      case 'COMPLETE':
        return <PartyPopper size={48} className="text-rowan-green animate-scale-in" />
      case 'REFUNDED':
        return (
          <div className="flex flex-col items-center animate-scale-in">
            <RotateCcw size={48} className="text-rowan-yellow" />
            <div className="flex items-center gap-1 mt-3 bg-rowan-green/10 rounded-full px-3 py-1">
              <ShieldCheck size={14} className="text-rowan-green" />
              <span className="text-rowan-green text-xs font-medium">Funds safe</span>
            </div>
          </div>
        )
      case 'FAILED':
        return <XCircle size={48} className="text-rowan-red animate-scale-in" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <div className="animate-spin text-rowan-yellow">
          <RotateCcw size={24} />
        </div>
      </div>
    )
  }

  if (isWaiting && !transaction) {
    return (
      <div className="bg-rowan-bg min-h-screen px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-rowan-text text-lg font-bold">Transaction</h1>
        </div>
        <div className="bg-rowan-surface rounded-xl p-8 text-center">
          <div className="animate-pulse mb-4">
            <Clock size={40} className="text-rowan-yellow mx-auto" />
          </div>
          <p className="text-rowan-text text-sm font-medium mb-2">Waiting for confirmation...</p>
          <p className="text-rowan-muted text-xs mb-4">
            Your transaction has been broadcast. The network is confirming it now.
            {stellarTxHash && <> Tx: {stellarTxHash.slice(0, 16)}...</>}
          </p>
          <p className="text-rowan-muted text-xs mt-2">
            This usually takes 10-60 seconds
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-rowan-bg min-h-screen px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-rowan-text text-lg font-bold">Transaction</h1>
        </div>
        <div className="bg-rowan-surface rounded-xl p-6 text-center">
          <XCircle size={32} className="text-rowan-red mx-auto mb-3" />
          <p className="text-rowan-red text-sm">{error}</p>
          <button
            onClick={() => navigate('/wallet/home', { replace: true })}
            className="text-rowan-yellow text-sm underline mt-4"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/wallet/home')} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Transaction Status</h1>
      </div>

      {isTerminal && (
        <div className="flex flex-col items-center py-6 animate-scale-in">
          {terminalIcon()}
          <p className="text-rowan-text text-sm text-center mt-4 max-w-xs">
            {terminalMessage()}
          </p>
        </div>
      )}

      {transaction && <TransactionStateTracker currentState={transaction.state} />}

      {/* Confirmation prompt for FIAT_PAYOUT_SUBMITTED */}
      {transaction && transaction.state === 'FIAT_PAYOUT_SUBMITTED' && (
        <div className="bg-rowan-surface rounded-xl p-4 my-6 space-y-4">
          <div className="text-center">
            <p className="text-rowan-text text-sm font-medium">
              Trader says they sent {transaction.fiat_amount} {transaction.fiat_currency}
            </p>
            <p className="text-rowan-muted text-xs mt-1 mb-3">
              to your {transaction.network} number
            </p>
          </div>
          <p className="text-rowan-text text-sm text-center">
            Did you receive the money?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowConfirmModal(true)}
            >
              Yes, I Received It
            </Button>
            <Button
              variant="ghost"
              className="text-rowan-red border-rowan-red"
              onClick={() => setShowDisputeModal(true)}
            >
              I Did Not Receive It
            </Button>
          </div>
        </div>
      )}

      {isTerminal && (
        <div className="mt-8 space-y-3">
          <Button onClick={() => navigate('/wallet/home', { replace: true })}>
            Back to Home
          </Button>
          {transaction.state === 'COMPLETE' && (
            <button
              onClick={() => navigate(`/wallet/receipt/${id}`)}
              className="w-full flex items-center justify-center gap-2 bg-rowan-surface border border-rowan-border rounded-xl px-4 py-3 min-h-11"
            >
              <FileText size={16} className="text-rowan-text" />
              <span className="text-rowan-text text-sm font-medium">View Receipt</span>
            </button>
          )}
          {transaction.state === 'REFUNDED' && (
            <button
              onClick={() => navigate('/wallet/cashout', { replace: true })}
              className="w-full text-rowan-yellow text-sm underline min-h-11"
            >
              Try another cash out
            </button>
          )}
        </div>
      )}

      {/* Confirm Receipt Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowConfirmModal(false)}>
          <div
            className="bg-rowan-surface rounded-t-2xl p-6 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-6" />
            <h3 className="text-rowan-text font-bold text-lg">Confirm Receipt</h3>
            <p className="text-rowan-muted text-sm mt-3 mb-4">
              Only continue if the money is already in your mobile money account.
            </p>
            <p className="text-rowan-yellow text-sm font-semibold mb-4">
              Once confirmed, escrowed USDC will be released to the trader.
            </p>
            {confirmError && (
              <p className="text-rowan-red text-sm mb-4">{confirmError}</p>
            )}
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                loading={confirming}
                onClick={handleConfirmReceipt}
              >
                Confirm and Release
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowConfirmModal(false)}
                className="text-rowan-muted border-rowan-border"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowDisputeModal(false)}>
          <div
            className="bg-rowan-surface rounded-t-2xl p-6 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-6" />
            <h3 className="text-rowan-text font-bold text-lg">Report Missing Payment</h3>
            <p className="text-rowan-muted text-sm mt-3 mb-4">
              Only open a dispute if the money has not arrived in your mobile money account.
            </p>
            <p className="text-rowan-muted text-sm mb-4">
              An admin will review the trader's reference and transaction details.
            </p>
            <textarea
              placeholder="Describe what happened (optional)"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="w-full bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-rowan-text placeholder-rowan-muted text-sm focus:outline-none focus:border-rowan-yellow mb-4"
              rows={3}
            />
            {disputeError && (
              <p className="text-rowan-red text-sm mb-4">{disputeError}</p>
            )}
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                className="bg-rowan-red hover:bg-rowan-red/80"
                size="lg"
                loading={disputing}
                onClick={handleOpenDispute}
              >
                Open Dispute
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDisputeModal(false)
                  setDisputeReason('')
                  setDisputeError(null)
                }}
                className="text-rowan-muted border-rowan-border"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
