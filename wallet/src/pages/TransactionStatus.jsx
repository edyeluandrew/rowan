import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, PartyPopper, RotateCcw, XCircle, ShieldCheck, FileText } from 'lucide-react'
import { getTransactionStatus } from '../api/cashout'
import useSocketHook from '../hooks/useSocket'
import TransactionStateTracker from '../components/cashout/TransactionStateTracker'
import Button from '../components/ui/Button'

const TERMINAL_STATES = ['COMPLETE', 'REFUNDED', 'FAILED']

export default function TransactionStatus() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [transaction, setTransaction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      try {
        const tx = await getTransactionStatus(id)
        if (!cancelled) setTransaction(tx)
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
            onClick={() => navigate('/home', { replace: true })}
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
        <button onClick={() => navigate('/home')} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
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

      <TransactionStateTracker currentState={transaction.state} />

      {isTerminal && (
        <div className="mt-8 space-y-3">
          <Button onClick={() => navigate('/home', { replace: true })}>
            Back to Home
          </Button>
          {transaction.state === 'COMPLETE' && (
            <button
              onClick={() => navigate(`/receipt/${id}`)}
              className="w-full flex items-center justify-center gap-2 bg-rowan-surface border border-rowan-border rounded-xl px-4 py-3 min-h-11"
            >
              <FileText size={16} className="text-rowan-text" />
              <span className="text-rowan-text text-sm font-medium">View Receipt</span>
            </button>
          )}
          {transaction.state === 'REFUNDED' && (
            <button
              onClick={() => navigate('/cashout', { replace: true })}
              className="w-full text-rowan-yellow text-sm underline min-h-11"
            >
              Try another cash out
            </button>
          )}
        </div>
      )}
    </div>
  )
}
