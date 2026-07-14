import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Star, Smartphone, Clock, Copy, CopyCheck, FileText, ShieldCheck } from 'lucide-react'
import { getTransactionStatus, confirmReceipt, openDispute } from '../api/cashout'
import { listDisputeEvidence as listUserEvidence, uploadDisputeEvidence } from '../api/user'
import { getReviewStatus } from '../api/reviews'
import ReviewModal from '../components/reviews/ReviewModal'
import DisputeEvidenceSection from '../components/disputes/DisputeEvidenceSection'
import DisputeStatusCard from '../components/disputes/DisputeStatusCard'
import ReceiptConfirmationCard from '../components/disputes/ReceiptConfirmationCard'
import ConfirmingReceiptCard from '../components/disputes/ConfirmingReceiptCard'
import DisputeConfirmModal from '../components/disputes/DisputeConfirmModal'
import useSocketHook from '../hooks/useSocket'
import TransactionStatusBadge from '../components/transactions/TransactionStatusBadge'
// import TransactionStateTracker from '../components/cashout/TransactionStateTracker'
import PaymentWindowCountdown from '../components/cashout/PaymentWindowCountdown'
import OrderChat from '../components/chat/OrderChat'
import OrderShortId from '../components/ui/OrderShortId'
import useJoinOrder from '../hooks/useJoinOrder'
import { formatCurrency, getTraderDisplayName } from '../utils/p2pFormat'
import { formatDateTime, formatAddress } from '../utils/format'
import { normalizeWalletTransaction, isManualP2pTransaction, isBuyOrder } from '../utils/transactions'
import { NETWORKS, COPY_FEEDBACK_TIMEOUT_MS } from '../utils/constants'

export default function TransactionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tx, setTx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)
  const [confirmingReceipt, setConfirmingReceipt] = useState(false)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [openingDispute, setOpeningDispute] = useState(false)
  const [disputeError, setDisputeError] = useState(null)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)

  useEffect(() => {
    if (!id || !tx || tx.state !== 'COMPLETE') return
    getReviewStatus(id)
      .then((data) => setReviewSubmitted(!!data?.submitted))
      .catch(() => {})
  }, [id, tx?.state])

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      try {
        const data = await getTransactionStatus(id)
        if (!cancelled) setTx(normalizeWalletTransaction(data))
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [id])

  useSocketHook('transaction_update', (data) => {
    if (data.transactionId === id) {
      setTx((prev) => (prev ? normalizeWalletTransaction({ ...prev, ...data }) : prev))
    }
  })

  useSocketHook('transaction_complete', (data) => {
    if (data.transactionId === id) {
      setTx((prev) => (prev ? normalizeWalletTransaction({ ...prev, state: 'COMPLETE', ...data }) : prev))
    }
  })

  useSocketHook('transaction_refunded', (data) => {
    if (data.transactionId === id) {
      setTx((prev) => (prev ? normalizeWalletTransaction({ ...prev, state: 'REFUNDED', ...data }) : prev))
    }
  })

  useSocketHook('dispute_opened', (data) => {
    if (data.transactionId === id) {
      setTx((prev) => (prev ? normalizeWalletTransaction({ ...prev, state: 'DISPUTE_OPENED', ...data }) : prev))
    }
  })

  useSocketHook('dispute_resolved', (data) => {
    if (data.transactionId === id) {
      setTx((prev) => (prev ? normalizeWalletTransaction({ ...prev, state: data.newState, ...data }) : prev))
    }
  })

  const inProgress = tx && !['COMPLETE', 'REFUNDED', 'FAILED'].includes(tx.state)
  const isComplete = tx?.state === 'COMPLETE'
  const isBuy = isBuyOrder(tx)

  // Active orders use TransactionStatus (has buy "I have sent fiat" / sell confirm)
  useEffect(() => {
    if (tx && inProgress) {
      navigate(`/wallet/transaction/${id}`, { replace: true })
    }
  }, [tx, inProgress, id, navigate])

  const appealWindowOpen = isComplete
    && tx?.appealExpiresAt
    && new Date(tx.appealExpiresAt) > new Date()
    && !tx?.appealArchivedAt
  useJoinOrder(inProgress && isManualP2pTransaction(tx) ? id : null)

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(field)
      setTimeout(() => setCopied(null), COPY_FEEDBACK_TIMEOUT_MS)
    } catch {
      // clipboard not available
    }
  }

  const handleConfirmReceipt = async () => {
    setConfirmingReceipt(true)
    try {
      await confirmReceipt(id)
      setTx((prev) => (prev ? { ...prev, state: 'COMPLETE' } : prev))
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm receipt')
    } finally {
      setConfirmingReceipt(false)
    }
  }

  const handleOpenDispute = async () => {
    setOpeningDispute(true)
    try {
      await openDispute(id, 'Did not receive mobile money')
      setTx((prev) => (prev ? { ...prev, state: 'DISPUTE_OPENED' } : prev))
      setShowDisputeModal(false)
    } catch (err) {
      setDisputeError(err.response?.data?.error || 'Failed to open dispute')
    } finally {
      setOpeningDispute(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <div className="animate-spin text-rowan-yellow">
          <Clock size={24} />
        </div>
      </div>
    )
  }

  if (error || !tx) {
    return (
      <div className="bg-rowan-bg min-h-screen px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
            <ChevronLeft size={24} />
          </button>
        </div>
        <div className="bg-rowan-surface rounded-xl p-6 text-center">
          <p className="text-rowan-red text-sm">{error || 'Transaction not found'}</p>
        </div>
      </div>
    )
  }

  if (inProgress) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <div className="animate-spin text-rowan-yellow">
          <Clock size={24} />
        </div>
      </div>
    )
  }

  const network = NETWORKS[tx.network] || {}

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Transaction Detail</h1>
      </div>

      {/* Status banner */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <TransactionStatusBadge state={tx.state} />
          <span className="text-rowan-muted text-xs">{formatDateTime(tx.createdAt)}</span>
        </div>
        <div className="mt-2">
          <OrderShortId transactionId={tx.id} />
        </div>
      </div>

      {/* Trader info */}
      {tx.traderName && (
        <div className="bg-rowan-surface rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-rowan-muted text-xs">Trader</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-rowan-text text-sm font-semibold">
                  {getTraderDisplayName(tx.traderName)}
                </span>
                <ShieldCheck size={14} className="text-rowan-green" />
              </div>
              <p className="text-rowan-muted text-xs mt-2">
                {tx.selectionMethod === 'manual' ? 'You chose this trader' : 'Auto-matched'}
              </p>
            </div>
            {tx.traderId && (
              <button
                type="button"
                onClick={() => navigate(`/wallet/traders/${tx.traderId}`)}
                className="text-rowan-yellow text-xs font-medium min-h-11 px-3"
              >
                View profile
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dispute status cards */}
      {['DISPUTE_OPENED', 'DISPUTE_RELEASE_PENDING', 'DISPUTE_REFUND_PENDING', 'RELEASE_BLOCKED', 'REFUNDED'].includes(tx.state) && (
        <div className="mb-4">
          <DisputeStatusCard state={tx.state} data={tx} />
        </div>
      )}

      {/* Receipt confirmation — sell only (buy waits for trader) */}
      {!isBuy && tx.state === 'FIAT_PAYOUT_SUBMITTED' && (
        <div className="mb-4">
          <ReceiptConfirmationCard
            onConfirmReceipt={handleConfirmReceipt}
            onOpenDispute={() => setShowDisputeModal(true)}
            isLoading={confirmingReceipt}
          />
        </div>
      )}

      {!isBuy && tx.state === 'USER_CONFIRMATION_PENDING' && (
        <div className="mb-4">
          <ConfirmingReceiptCard />
        </div>
      )}

      {isBuy && tx.state === 'FIAT_PAYOUT_SUBMITTED' && (
        <div className="bg-rowan-surface rounded-xl p-4 mb-4 text-center">
          <p className="text-rowan-text text-sm font-medium">Waiting for trader to confirm MoMo</p>
          <p className="text-rowan-muted text-xs mt-2">Then escrow releases USDC to your wallet.</p>
        </div>
      )}

      {tx.state === 'TRADER_MATCHED' && tx.paymentExpiresAt && (
        <PaymentWindowCountdown expiresAt={tx.paymentExpiresAt} />
      )}

      {isManualP2pTransaction(tx) && (inProgress || isComplete) && (
        <div className="mb-4">
          <OrderChat
            transactionId={id}
            txState={tx.state}
            counterpartyName={getTraderDisplayName(tx.traderName)}
            viewerRole="user"
          />
        </div>
      )}

      {tx.state === 'DISPUTE_OPENED' && tx.disputeId && (
        <DisputeEvidenceSection
          disputeId={tx.disputeId}
          uploadEvidence={uploadDisputeEvidence}
          listEvidence={listUserEvidence}
        />
      )}

      {appealWindowOpen && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <p className="text-rowan-muted text-xs text-center">
            You can still raise a dispute within the appeal window if you have an issue.
          </p>
        </div>
      )}

      {isComplete && tx.appealArchivedAt && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <p className="text-rowan-muted text-xs text-center">This order is complete and archived.</p>
        </div>
      )}
      {disputeError && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mb-4">
          <p className="text-rowan-red text-sm">{disputeError}</p>
        </div>
      )}

      {/* Amounts */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-rowan-green" />
            <span className="text-rowan-text text-sm">{isBuy ? 'USDC received' : 'USDC sent'}</span>
          </div>
          <span className="text-rowan-text font-semibold">
            {Number(tx.usdcAmount || tx.xlmAmount || 0).toFixed(2)} USDC
          </span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-rowan-green" />
            <span className="text-rowan-text text-sm">{isBuy ? 'Fiat sent' : 'Fiat received'}</span>
          </div>
          <span className="text-rowan-green font-semibold">
            {formatCurrency(tx.fiatAmount, tx.fiatCurrency || network.currency)}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4 space-y-3">
        <DetailRow
          label="Network"
          value={network.label || tx.network}
        />
        <DetailRow
          label="Transaction ID"
          value={tx.id}
          copyable
          copied={copied === 'id'}
          onCopy={() => handleCopy(tx.id, 'id')}
        />
        {tx.escrowAddress && (
          <DetailRow
            label="Escrow Address"
            value={formatAddress(tx.escrowAddress)}
            copyable
            copied={copied === 'escrow'}
            onCopy={() => handleCopy(tx.escrowAddress, 'escrow')}
          />
        )}
        {tx.memo && (
          <DetailRow label="Memo" value={tx.memo} />
        )}
        {tx.stellar_release_tx && (
          <DetailRow
            label="Stellar Release TX"
            value={formatAddress(tx.stellar_release_tx)}
            copyable
            copied={copied === 'release'}
            onCopy={() => handleCopy(tx.stellar_release_tx, 'release')}
          />
        )}
        {tx.stellarTxHash && (
          <DetailRow
            label="Stellar TX"
            value={formatAddress(tx.stellarTxHash)}
            copyable
            copied={copied === 'stellar'}
            onCopy={() => handleCopy(tx.stellarTxHash, 'stellar')}
          />
        )}
      </div>

      {/* Pilot: hide history timeline */}
      {/* <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <h3 className="text-rowan-text text-sm font-semibold mb-3">Timeline</h3>
        <TransactionStateTracker currentState={tx.state} timestamps={timestamps} orderSide={isBuy ? 'BUY' : 'SELL'} />
      </div> */}

      {isComplete && !reviewSubmitted && (
        <button
          type="button"
          onClick={() => setShowReviewModal(true)}
          className="w-full bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl px-4 py-3 min-h-11 mb-4 text-rowan-yellow text-sm font-medium"
        >
          Leave a review
        </button>
      )}

      {isComplete && reviewSubmitted && (
        <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl px-4 py-3 mb-4">
          <p className="text-rowan-green text-sm text-center">Review submitted</p>
        </div>
      )}

      {/* Receipt button — completed transactions */}
      {tx.state === 'COMPLETE' && (
        <button
          onClick={() => navigate(`/wallet/receipt/${tx.id}`)}
          className="w-full flex items-center justify-center gap-2 bg-rowan-surface border border-rowan-border rounded-xl px-4 py-3 min-h-11 mt-4"
        >
          <FileText size={16} className="text-rowan-text" />
          <span className="text-rowan-text text-sm font-medium">View Receipt</span>
        </button>
      )}

      {showReviewModal && (
        <ReviewModal
          transactionId={id}
          traderName={tx.traderName}
          onClose={() => setShowReviewModal(false)}
          onSubmitted={() => {
            setReviewSubmitted(true)
            setShowReviewModal(false)
          }}
        />
      )}

      {/* Dispute modal */}
      {showDisputeModal && (
        <DisputeConfirmModal
          onConfirm={handleOpenDispute}
          onCancel={() => setShowDisputeModal(false)}
          isLoading={openingDispute}
        />
      )}
    </div>
  )
}

function DetailRow({ label, value, copyable, copied, onCopy }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-rowan-muted text-xs">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-rowan-text text-xs font-mono">{value}</span>
        {copyable && (
          <button onClick={onCopy} className="text-rowan-muted ml-1">
            {copied ? <CopyCheck size={12} className="text-rowan-green" /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  )
}
