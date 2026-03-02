import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Star, Smartphone, Clock, Copy, CopyCheck, AlertTriangle } from 'lucide-react'
import { getTransactionStatus } from '../api/cashout'
import useSocketHook from '../hooks/useSocket'
import TransactionStatusBadge from '../components/transactions/TransactionStatusBadge'
import TransactionStateTracker from '../components/cashout/TransactionStateTracker'
import { formatXlm, formatCurrency, formatDateTime, formatAddress } from '../utils/format'
import { NETWORKS } from '../utils/constants'

export default function TransactionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tx, setTx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      try {
        const data = await getTransactionStatus(id)
        if (!cancelled) setTx(data)
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
      setTx((prev) => (prev ? { ...prev, ...data } : prev))
    }
  })

  useSocketHook('transaction_complete', (data) => {
    if (data.transactionId === id) {
      setTx((prev) => (prev ? { ...prev, state: 'COMPLETE', ...data } : prev))
    }
  })

  useSocketHook('transaction_refunded', (data) => {
    if (data.transactionId === id) {
      setTx((prev) => (prev ? { ...prev, state: 'REFUNDED', ...data } : prev))
    }
  })

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // clipboard not available
    }
  }

  const canDispute = tx && tx.state === 'COMPLETE' && tx.completedAt &&
    Date.now() - new Date(tx.completedAt).getTime() < 24 * 60 * 60 * 1000

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
      </div>

      {/* Amounts */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-rowan-yellow" />
            <span className="text-rowan-text text-sm">XLM Sent</span>
          </div>
          <span className="text-rowan-text font-semibold">{formatXlm(tx.xlmAmount)}</span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-rowan-green" />
            <span className="text-rowan-text text-sm">Fiat Received</span>
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

      {/* Timeline */}
      <div className="bg-rowan-surface rounded-xl p-4 mb-4">
        <h3 className="text-rowan-text text-sm font-semibold mb-3">Progress</h3>
        <TransactionStateTracker currentState={tx.state} compact />
      </div>

      {/* Dispute button */}
      {canDispute && (
        <button
          onClick={() => navigate(`/dispute/${tx.id}`)}
          className="w-full flex items-center justify-center gap-2 bg-rowan-red/10 border border-rowan-red/30 rounded-xl px-4 py-3 min-h-11 mt-4"
        >
          <AlertTriangle size={16} className="text-rowan-red" />
          <span className="text-rowan-red text-sm font-medium">File Dispute</span>
        </button>
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
