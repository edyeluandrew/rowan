import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import TopBar from '../../../shared/components/layout/TopBar'
import TransactionStateTag from '../components/TransactionStateTag'
import CopyButton from '../../../shared/components/ui/CopyButton'
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog'
import Button from '../../../shared/components/ui/Button'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'
import { getTransaction, forceRefund, forceComplete } from '../../../shared/services/api/transactions'
import { logAdminAction } from '../../../shared/services/api/system'
import { formatUsdc, formatCurrency, formatDateTime, formatAddress } from '../../../shared/utils/format'
import { STATE_ORDER, STELLAR_EXPLORER_URL } from '../../../shared/utils/constants'

export default function TransactionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tx, setTx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState({ open: false, action: null, title: '', message: '' })
  const [actionLoading, setActionLoading] = useState(false)

  const fetchTx = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTransaction(id)
      setTx(data.transaction || data)
    } catch (err) {
      setError(err?.message || 'Failed to load transaction')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchTx() }, [fetchTx])

  const handleAction = (action, title, message) => {
    setConfirm({ open: true, action, title, message })
  }

  const executeAction = async () => {
    setActionLoading(true)
    try {
      if (confirm.action === 'refund') {
        await forceRefund(id)
        logAdminAction('force_refund', { transactionId: id, usdc_amount: tx?.usdc_amount })
      } else if (confirm.action === 'complete') {
        await forceComplete(id)
        logAdminAction('force_complete', { transactionId: id, usdc_amount: tx?.usdc_amount })
      }
      setConfirm({ open: false, action: null, title: '', message: '' })
      await fetchTx()
    } catch {
      /* error handled by interceptor */
    } finally {
      setActionLoading(false)
    }
  }

  const stateIndex = tx ? STATE_ORDER.indexOf(tx.state) : -1

  return (
    <>
      <TopBar title="Transaction Detail" onRefresh={fetchTx} refreshing={loading} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <button onClick={() => navigate('/transactions')} className="flex items-center gap-2 text-rowan-muted hover:text-rowan-text text-sm">
          <ArrowLeft size={16} />
          <span>Back to Transactions</span>
        </button>

        {loading && !tx ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : error ? (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">{error}</div>
        ) : tx ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* State Timeline */}
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <h3 className="text-rowan-text font-bold mb-4">State Timeline</h3>
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {STATE_ORDER.map((state, i) => {
                    const isActive = state === tx.state
                    const isPast = i < stateIndex
                    return (
                      <div key={state} className="flex items-center gap-1 shrink-0">
                        <div className={`w-3 h-3 rounded-full border-2 ${
                          isActive ? 'border-rowan-yellow bg-rowan-yellow' :
                          isPast ? 'border-rowan-green bg-rowan-green' :
                          'border-rowan-border bg-transparent'
                        }`} />
                        <span className={`text-[10px] ${isActive ? 'text-rowan-yellow font-bold' : isPast ? 'text-rowan-green' : 'text-rowan-muted'}`}>
                          {state.replace(/_/g, ' ')}
                        </span>
                        {i < STATE_ORDER.length - 1 && (
                          <div className={`w-6 h-px ${isPast ? 'bg-rowan-green' : 'bg-rowan-border'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Transaction Details */}
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <h3 className="text-rowan-text font-bold mb-4">Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Transaction ID" value={tx.id} copy />
                  <Field label="State" value={<TransactionStateTag state={tx.state} />} />
                  <Field label="USDC Amount" value={`${formatUsdc(tx.usdc_amount)} USDC`} />
                  <Field label="Fiat Amount" value={formatCurrency(tx.fiat_amount, tx.fiat_currency)} />
                  <Field label="Mobile Network" value={tx.network || '-'} />
                  <Field label="Trader" value={tx.trader_name || formatAddress(tx.trader_id || '')} />
                  <Field label="Locked Rate" value={tx.locked_rate ? `${Number(tx.locked_rate).toFixed(2)} UGX` : '-'} />
                  <Field label="Platform Fee" value={tx.platform_fee ? `${formatUsdc(tx.platform_fee)} USDC` : '-'} />
                  <Field label="Created" value={formatDateTime(tx.created_at)} />
                  <Field label="Updated" value={formatDateTime(tx.updated_at)} />
                  {tx.escrow_locked_at && <Field label="Escrow Locked" value={formatDateTime(tx.escrow_locked_at)} />}
                  {tx.completed_at && <Field label="Completed" value={formatDateTime(tx.completed_at)} />}
                  {tx.failure_reason && <Field label="Failure Reason" value={tx.failure_reason} />}
                  {tx.stellar_deposit_tx && (
                    <div className="col-span-2">
                      <p className="text-rowan-muted text-xs mb-1">Stellar Deposit TX</p>
                      <a href={`${STELLAR_EXPLORER_URL}/transactions/${tx.stellar_deposit_tx}`} target="_blank" rel="noopener noreferrer" className="text-rowan-yellow text-sm hover:underline break-all">
                        {tx.stellar_deposit_tx}
                      </a>
                    </div>
                  )}
                  {tx.stellar_release_tx && (
                    <div className="col-span-2">
                      <p className="text-rowan-muted text-xs mb-1">Stellar Release TX</p>
                      <a href={`${STELLAR_EXPLORER_URL}/transactions/${tx.stellar_release_tx}`} target="_blank" rel="noopener noreferrer" className="text-rowan-yellow text-sm hover:underline break-all">
                        {tx.stellar_release_tx}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Actions */}
            <div className="space-y-4">
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <h3 className="text-rowan-text font-bold mb-4">Admin Actions</h3>
                <div className="space-y-3">
                  <Button variant="danger" className="w-full" onClick={() => handleAction('refund', 'Force Refund', `This will force a refund for transaction ${formatAddress(tx.id)}. The locked USDC will be returned to the user. This action cannot be undone.`)}>
                    Force Refund
                  </Button>
                  <Button variant="success" className="w-full" onClick={() => handleAction('complete', 'Force Complete', `This will mark transaction ${formatAddress(tx.id)} as complete and release funds to the trader. This action cannot be undone.`)}>
                    Force Complete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open: false, action: null, title: '', message: '' })} onConfirm={executeAction} title={confirm.title} message={confirm.message} confirmLabel={confirm.action === 'refund' ? 'Force Refund' : 'Force Complete'} loading={actionLoading} variant={confirm.action === 'refund' ? 'danger' : 'success'} />
      </div>
    </>
  )
}

function Field({ label, value, copy }) {
  return (
    <div>
      <p className="text-rowan-muted text-xs mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-rowan-text text-sm">{value}</span>
        {copy && <CopyButton value={typeof copy === 'string' ? copy : String(value)} size={12} />}
      </div>
    </div>
  )
}
