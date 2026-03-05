import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import TopBar from '../components/layout/TopBar'
import TraderStatusBadge from '../components/traders/TraderStatusBadge'
import FloatBar from '../components/traders/FloatBar'
import CopyButton from '../components/ui/CopyButton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { getTrader, approveTrader, suspendTrader, reactivateTrader, updateTraderLimits, adjustFloat } from '../api/traders'
import { logAdminAction } from '../api/system'
import { formatCurrency, formatNumber, formatPercent, formatDateTime, formatAddress } from '../utils/format'
import { SUSPEND_REASON_MIN_LENGTH } from '../utils/constants'

export default function TraderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [trader, setTrader] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState({ open: false, action: null, title: '', message: '' })
  const [actionLoading, setActionLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  const [limitForm, setLimitForm] = useState({ daily_limit: '', monthly_limit: '' })
  const [limitErrors, setLimitErrors] = useState({})
  const [floatAmount, setFloatAmount] = useState('')
  const [floatNote, setFloatNote] = useState('')
  const [floatErrors, setFloatErrors] = useState({})
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendError, setSuspendError] = useState('')

  const fetchTrader = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTrader(id)
      setTrader(data)
      setLimitForm({
        daily_limit: String(data.daily_limit || ''),
        monthly_limit: String(data.monthly_limit || ''),
      })
    } catch (err) {
      setError(err?.message || 'Failed to load trader')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchTrader() }, [fetchTrader])

  const handleAction = (action, title, message) => {
    setConfirm({ open: true, action, title, message })
  }

  const executeAction = async () => {
    setActionLoading(true)
    try {
      if (confirm.action === 'approve') {
        await approveTrader(id)
        logAdminAction('approve_trader', { traderId: id })
      } else if (confirm.action === 'suspend') {
        await suspendTrader(id, suspendReason)
        logAdminAction('suspend_trader', { traderId: id, reason: suspendReason })
        setSuspendReason('')
      } else if (confirm.action === 'reactivate') {
        await reactivateTrader(id)
        logAdminAction('reactivate_trader', { traderId: id })
      } else if (confirm.action === 'limits') {
        const daily = Number(limitForm.daily_limit)
        const monthly = Number(limitForm.monthly_limit)
        await updateTraderLimits(id, { daily_limit: daily, monthly_limit: monthly })
        logAdminAction('update_trader_limits', { traderId: id, daily_limit: daily, monthly_limit: monthly })
      } else if (confirm.action === 'float') {
        const amount = Number(floatAmount)
        await adjustFloat(id, { amount, note: floatNote })
        logAdminAction('adjust_float', { traderId: id, amount, note: floatNote })
        setFloatAmount('')
        setFloatNote('')
      }
      setConfirm({ open: false, action: null, title: '', message: '' })
      await fetchTrader()
    } catch {
      /* handled by interceptor */
    } finally {
      setActionLoading(false)
    }
  }

  const TABS = [
    { value: 'overview', label: 'Overview' },
    { value: 'settings', label: 'Settings' },
  ]

  return (
    <>
      <TopBar title="Trader Detail" onRefresh={fetchTrader} refreshing={loading} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <button onClick={() => navigate('/traders')} className="flex items-center gap-2 text-rowan-muted hover:text-rowan-text text-sm">
          <ArrowLeft size={16} />
          <span>Back to Traders</span>
        </button>

        {loading && !trader ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : error ? (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">{error}</div>
        ) : trader ? (
          <>
            {/* Header */}
            <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-rowan-text text-xl font-bold">{trader.name || formatAddress(trader.id)}</h3>
                  <TraderStatusBadge status={trader.status} />
                </div>
                <div className="flex items-center gap-2 text-rowan-muted text-sm">
                  <span>{trader.phone || '-'}</span>
                  {trader.id && <CopyButton value={trader.id} size={12} />}
                </div>
              </div>
              <div className="flex gap-2">
                {trader.status === 'pending' && (
                  <Button variant="success" onClick={() => handleAction('approve', 'Approve Trader', `Approve ${trader.name || trader.id} as an active trader?`)}>
                    Approve
                  </Button>
                )}
                {trader.status === 'active' && (
                  <Button variant="danger" onClick={() => {
                    setSuspendError('')
                    handleAction('suspend', 'Suspend Trader', `Suspend ${trader.name || trader.id}? They will not receive new transactions.`)
                  }}>
                    Suspend
                  </Button>
                )}
                {trader.status === 'suspended' && (
                  <Button variant="success" onClick={() => handleAction('reactivate', 'Reactivate Trader', `Reactivate ${trader.name || trader.id}?`)}>
                    Reactivate
                  </Button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Total Volume" value={formatCurrency(trader.total_volume)} />
              <StatBox label="Completed" value={formatNumber(trader.completed_count)} />
              <StatBox label="Success Rate" value={formatPercent(trader.success_rate)} />
              <StatBox label="Joined" value={formatDateTime(trader.created_at)} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-rowan-surface rounded-xl p-1 border border-rowan-border w-fit">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    tab === t.value
                      ? 'bg-rowan-yellow/10 text-rowan-yellow font-medium'
                      : 'text-rowan-muted hover:text-rowan-text'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Daily Limit" value={formatCurrency(trader.daily_limit)} />
                  <Field label="Monthly Limit" value={formatCurrency(trader.monthly_limit)} />
                  <Field label="Float Balance" value={formatCurrency(trader.float_balance)} />
                  <Field label="Float Limit" value={formatCurrency(trader.float_limit)} />
                </div>
                <div className="w-64">
                  <FloatBar current={trader.float_balance} limit={trader.float_limit} />
                </div>
              </div>
            )}

            {tab === 'settings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4 space-y-3">
                  <h4 className="text-rowan-text font-bold">Transaction Limits</h4>
                  <Input
                    label="Daily Limit (USD)"
                    type="number"
                    value={limitForm.daily_limit}
                    onChange={(e) => { setLimitForm({ ...limitForm, daily_limit: e.target.value }); setLimitErrors({}) }}
                  />
                  {limitErrors.daily_limit && <p className="text-rowan-red text-xs">{limitErrors.daily_limit}</p>}
                  <Input
                    label="Monthly Limit (USD)"
                    type="number"
                    value={limitForm.monthly_limit}
                    onChange={(e) => { setLimitForm({ ...limitForm, monthly_limit: e.target.value }); setLimitErrors({}) }}
                  />
                  {limitErrors.monthly_limit && <p className="text-rowan-red text-xs">{limitErrors.monthly_limit}</p>}
                  <Button onClick={() => {
                    const errs = {}
                    const daily = Number(limitForm.daily_limit)
                    const monthly = Number(limitForm.monthly_limit)
                    if (!daily || daily <= 0) errs.daily_limit = 'Daily limit must be a positive number'
                    if (!monthly || monthly <= 0) errs.monthly_limit = 'Monthly limit must be a positive number'
                    if (daily > 0 && monthly > 0 && daily >= monthly) errs.daily_limit = 'Daily limit must be less than monthly limit'
                    if (Object.keys(errs).length) { setLimitErrors(errs); return }
                    handleAction('limits', 'Update Limits', `Set daily limit to $${daily.toLocaleString()} and monthly limit to $${monthly.toLocaleString()} for ${trader.name || trader.id}?`)
                  }}>
                    Save Limits
                  </Button>
                </div>

                <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4 space-y-3">
                  <h4 className="text-rowan-text font-bold">Adjust Float</h4>
                  <Input
                    label="Amount (USD)"
                    type="number"
                    value={floatAmount}
                    onChange={(e) => { setFloatAmount(e.target.value); setFloatErrors({}) }}
                    placeholder="Amount to add or subtract"
                  />
                  {floatErrors.amount && <p className="text-rowan-red text-xs">{floatErrors.amount}</p>}
                  <div>
                    <label className="text-rowan-muted text-xs block mb-1">Note</label>
                    <textarea
                      value={floatNote}
                      onChange={(e) => { setFloatNote(e.target.value); setFloatErrors({}) }}
                      placeholder="Reason for adjustment..."
                      rows={2}
                      className="w-full bg-rowan-bg border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow resize-none"
                    />
                  </div>
                  {floatErrors.note && <p className="text-rowan-red text-xs">{floatErrors.note}</p>}
                  <Button onClick={() => {
                    const errs = {}
                    const amount = Number(floatAmount)
                    if (!floatAmount || amount === 0 || isNaN(amount)) errs.amount = 'Amount must be a non-zero number'
                    if (!floatNote.trim()) errs.note = 'A note is required for float adjustments'
                    if (Object.keys(errs).length) { setFloatErrors(errs); return }
                    handleAction('float', 'Adjust Float', `Adjust float by $${amount.toLocaleString()} for ${trader.name || trader.id}. This cannot be undone.`)
                  }}>
                    Adjust Float
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}

        <ConfirmDialog
          open={confirm.open}
          onClose={() => { setConfirm({ open: false, action: null, title: '', message: '' }); setSuspendReason(''); setSuspendError('') }}
          onConfirm={() => {
            if (confirm.action === 'suspend' && suspendReason.trim().length < SUSPEND_REASON_MIN_LENGTH) {
              setSuspendError(`Reason must be at least ${SUSPEND_REASON_MIN_LENGTH} characters`)
              return
            }
            executeAction()
          }}
          title={confirm.title}
          message={confirm.message}
          loading={actionLoading}
          variant={confirm.action === 'suspend' ? 'danger' : 'primary'}
          confirmLabel={confirm.action === 'approve' ? 'Approve' : confirm.action === 'suspend' ? 'Suspend' : confirm.action === 'reactivate' ? 'Reactivate' : 'Confirm'}
        >
          {confirm.action === 'suspend' && (
            <div className="mt-3">
              <label className="text-rowan-muted text-xs block mb-1">Suspension Reason</label>
              <textarea
                value={suspendReason}
                onChange={(e) => { setSuspendReason(e.target.value); setSuspendError('') }}
                placeholder="Reason for suspension (min 10 chars)..."
                rows={2}
                className="w-full bg-rowan-bg border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow resize-none"
              />
              {suspendError && <p className="text-rowan-red text-xs mt-1">{suspendError}</p>}
            </div>
          )}
        </ConfirmDialog>
      </div>
    </>
  )
}

function StatBox({ label, value }) {
  return (
    <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
      <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-rowan-text text-lg font-bold">{value}</p>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-rowan-muted text-xs mb-1">{label}</p>
      <p className="text-rowan-text text-sm">{value}</p>
    </div>
  )
}
