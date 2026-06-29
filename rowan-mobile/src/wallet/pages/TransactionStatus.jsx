import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronLeft, PartyPopper, RotateCcw, XCircle, ShieldCheck, FileText, Clock, Fingerprint, ScanFace } from 'lucide-react'
import { getTransactionStatus, confirmReceipt, openDispute } from '../api/cashout'
import useSocketHook from '../hooks/useSocket'
import TransactionStateTracker from '../components/cashout/TransactionStateTracker'
import PaymentWindowCountdown from '../components/cashout/PaymentWindowCountdown'
import OrderChat from '../components/chat/OrderChat'
import ReviewModal from '../components/reviews/ReviewModal'
import { getReviewStatus } from '../api/reviews'
import useJoinOrder from '../hooks/useJoinOrder'
import Button from '../components/ui/Button'
import { useBiometricLock } from '../../shared/context/BiometricLockContext'
import useBiometrics from '../hooks/useBiometrics'
import { normalizeWalletTransaction, getTransactionStatusTimestamps } from '../utils/transactions'
import { STATE_SUBTITLES } from '../utils/constants'
import { formatCurrency, getStatusLabel, getNetworkLabel, getTraderDisplayName } from '../utils/p2pFormat'

const TERMINAL_STATES = ['COMPLETE', 'REFUNDED', 'FAILED']
const POLL_INTERVAL = 3000 // Poll every 3 seconds while waiting

export default function TransactionStatus() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { stellarTxHash, transactionId: passedTransactionId } = location.state || {}

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
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyingBiometric, setVerifyingBiometric] = useState(false)
  const [verifyError, setVerifyError] = useState(null)

  const { lockRequired } = useBiometricLock()
  const { authenticate, biometricType } = useBiometrics()
  const biometricLabel = biometricType === 'FACE_ID' ? 'Face ID' : 'Fingerprint'
  const BiometricIcon = biometricType === 'FACE_ID' ? ScanFace : Fingerprint

  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)

  const MAX_RETRIES_ON_404 = 40 // ~2 minutes (40 × 3 seconds)
  const INITIAL_WAIT_MS = 3000 // Escrow + swap can take several seconds on testnet
  const retryCountRef = useRef(0)

  // Prefer real transaction id from state; URL may temporarily hold quoteId while escrow processes.
  const statusId = passedTransactionId || id
  const activeTxId = transaction?.id || passedTransactionId || id

  useJoinOrder(activeTxId && transaction ? activeTxId : null)

  const mergeTransaction = (prev, patch) =>
    normalizeWalletTransaction({ ...(prev || {}), ...(patch || {}) })

  useEffect(() => {
    let cancelled = false
    let pollTimer = null
    let initialWaitTimer = null
    retryCountRef.current = 0

    const isNotFound = (err) =>
      err?.status === 404 ||
      err?.response?.status === 404 ||
      /transaction not found/i.test(err?.message || '')

    const fetchStatus = async () => {
      try {
        const tx = normalizeWalletTransaction(await getTransactionStatus(statusId))
        if (!cancelled) {
          console.log(`[TransactionStatus] ✅ Transaction found (attempt ${retryCountRef.current + 1})`)
          setTransaction(tx)
          setIsWaiting(false)
          setLoading(false)
          setRetryCount(0)
          retryCountRef.current = 0

          if (!TERMINAL_STATES.includes(tx.state)) {
            pollTimer = setTimeout(() => {
              if (!cancelled) fetchStatus()
            }, POLL_INTERVAL)
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (isNotFound(err)) {
            retryCountRef.current += 1
            setRetryCount(retryCountRef.current)
            if (retryCountRef.current >= MAX_RETRIES_ON_404) {
              setError('Transaction confirmation timeout — check your history or contact support')
              setLoading(false)
            } else {
              setIsWaiting(true)
              setLoading(false)
              console.log(`[TransactionStatus] Not yet recorded (${retryCountRef.current}/${MAX_RETRIES_ON_404}), retrying...`)
              pollTimer = setTimeout(() => {
                if (!cancelled) fetchStatus()
              }, POLL_INTERVAL)
            }
          } else {
            setError(err.message)
            setLoading(false)
            console.error(`[TransactionStatus] Error polling: ${err.message}`)
          }
        }
      }
    }

    initialWaitTimer = setTimeout(() => {
      if (!cancelled) fetchStatus()
    }, INITIAL_WAIT_MS)

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
      if (initialWaitTimer) clearTimeout(initialWaitTimer)
    }
  }, [statusId])

  useEffect(() => {
    if (!activeTxId || transaction?.state !== 'COMPLETE' || reviewSubmitted) return
    let cancelled = false
    getReviewStatus(activeTxId)
      .then((data) => {
        if (!cancelled && !data?.submitted) setShowReviewModal(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeTxId, transaction?.state, reviewSubmitted])

  const handleConfirmReceipt = async () => {
    // If biometric lock is enabled, require verification first
    if (lockRequired) {
      setShowVerifyModal(true)
      return
    }
    // No biometric lock, proceed directly
    await executeConfirmReceipt()
  }

  const handleVerifyAndRelease = async () => {
    setVerifyingBiometric(true)
    setVerifyError(null)
    try {
      const verified = await authenticate(`Verify to release USDC`)
      if (verified) {
        setShowVerifyModal(false)
        await executeConfirmReceipt()
      } else {
        setVerifyError('Verification cancelled')
      }
    } catch (err) {
      setVerifyError(err.message || 'Verification failed')
    } finally {
      setVerifyingBiometric(false)
    }
  }

  const executeConfirmReceipt = async () => {
    setConfirming(true)
    setConfirmError(null)
    try {
      const result = await confirmReceipt(activeTxId)
      // Update transaction state
      setTransaction((prev) => mergeTransaction(prev, { state: 'COMPLETE', ...result }))
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
      const result = await openDispute(activeTxId, disputeReason.trim())
      // Update transaction state
      setTransaction((prev) => mergeTransaction(prev, { state: 'DISPUTE_OPENED', ...result }))
      setShowDisputeModal(false)
      setDisputeReason('')
    } catch (err) {
      setDisputeError(err.response?.data?.error || err.message || 'Dispute opening failed')
    } finally {
      setDisputing(false)
    }
  }

  const applySocketUpdate = (data, fallbackState) => {
    const txId = data.transactionId || data.id
    if (txId === statusId || txId === id || txId === transaction?.id) {
      setTransaction((prev) =>
        mergeTransaction(prev || { id: txId }, {
          state: data.state || fallbackState || prev?.state,
          ...data,
        })
      )
      setIsWaiting(false)
      setLoading(false)
      setError(null)
    }
  }

  useSocketHook('transaction_update', (data) => applySocketUpdate(data))
  useSocketHook('tx_update', (data) => applySocketUpdate(data))
  useSocketHook('trader_matched', (data) => applySocketUpdate(data, 'TRADER_MATCHED'))
  useSocketHook('transaction_complete', (data) => applySocketUpdate(data, 'COMPLETE'))
  useSocketHook('transaction_refunded', (data) => applySocketUpdate(data, 'REFUNDED'))
  useSocketHook('transaction_failed', (data) => applySocketUpdate(data, 'FAILED'))

  const isTerminal = transaction && TERMINAL_STATES.includes(transaction.state)

  const terminalMessage = () => {
    if (!transaction) return ''
    switch (transaction.state) {
      case 'COMPLETE':
        return 'Transaction complete. Check your mobile money account for the partner payout.'
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
          <button
            onClick={() => navigate('/wallet/home', { replace: true })}
            className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-rowan-text text-lg font-bold">Transaction Status</h1>
        </div>
        <TransactionStateTracker currentState="QUOTE_CONFIRMED" />
        <div className="bg-rowan-surface rounded-xl p-8 text-center mt-6">
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

      {transaction && !isTerminal && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl px-4 py-3 mb-4 text-center">
          <p className="text-rowan-text text-sm font-semibold">{getStatusLabel(transaction.state)}</p>
          {STATE_SUBTITLES[transaction.state] && (
            <p className="text-rowan-muted text-xs mt-1">{STATE_SUBTITLES[transaction.state]}</p>
          )}
        </div>
      )}

      {transaction && (
        <TransactionStateTracker
          currentState={transaction.state}
          timestamps={getTransactionStatusTimestamps(transaction)}
        />
      )}

      {transaction?.state === 'TRADER_MATCHED' && transaction.paymentExpiresAt && (
        <PaymentWindowCountdown expiresAt={transaction.paymentExpiresAt} />
      )}

      {transaction && !isTerminal && activeTxId && (
        <div className="my-4">
          <OrderChat
            transactionId={activeTxId}
            txState={transaction.state}
            counterpartyName={getTraderDisplayName(transaction.traderName)}
            viewerRole="user"
          />
        </div>
      )}

      {/* Confirmation prompt when payout submitted or awaiting user confirmation */}
      {(transaction?.state === 'FIAT_PAYOUT_SUBMITTED' || transaction?.state === 'USER_CONFIRMATION_PENDING') && (
        <div className="bg-rowan-surface rounded-xl p-4 my-6 space-y-4">
          <div className="text-center">
            <p className="text-rowan-text text-sm font-medium">
              {formatCurrency(transaction.fiatAmount, transaction.fiatCurrency || transaction.currency)} sent to your {getNetworkLabel(transaction.network)} account
            </p>
            <p className="text-rowan-muted text-xs mt-2">
              Check your mobile money balance, then confirm below.
            </p>
          </div>
          <p className="text-rowan-text text-sm text-center font-medium">
            Did you receive the money?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowConfirmModal(true)}
            >
              Confirm Payment Received
            </Button>
            <Button
              variant="ghost"
              className="text-rowan-red border-rowan-red"
              onClick={() => setShowDisputeModal(true)}
            >
              Raise a Dispute
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
              onClick={() => navigate(`/wallet/receipt/${activeTxId}`)}
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

      {/* Biometric Verification Modal (before release) */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowVerifyModal(false)}>
          <div
            className="bg-rowan-surface rounded-t-2xl p-6 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-6" />
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-rowan-bg rounded-full flex items-center justify-center mb-4">
                <BiometricIcon size={32} className="text-rowan-yellow" />
              </div>
              <h3 className="text-rowan-text font-bold text-lg">Verify Your Identity</h3>
              <p className="text-rowan-muted text-sm mt-2 text-center">
                Use {biometricLabel} to confirm USDC release
              </p>
            </div>
            {verifyError && (
              <p className="text-rowan-red text-sm mb-4 text-center">{verifyError}</p>
            )}
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                loading={verifyingBiometric}
                onClick={handleVerifyAndRelease}
              >
                {verifyingBiometric ? 'Verifying...' : `Verify with ${biometricLabel}`}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowVerifyModal(false)
                  setVerifyError(null)
                }}
                className="text-rowan-muted border-rowan-border"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <ReviewModal
          transactionId={activeTxId}
          traderName={transaction?.traderName}
          onClose={() => setShowReviewModal(false)}
          onSubmitted={() => setReviewSubmitted(true)}
        />
      )}
    </div>
  )
}
