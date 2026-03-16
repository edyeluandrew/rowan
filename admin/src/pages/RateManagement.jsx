import { useState, useEffect, useCallback } from 'react'
import TopBar from '../components/layout/TopBar'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { AlertTriangle } from 'lucide-react'
import { getRates, updateRates, logAdminAction } from '../api/system'
import { formatDateTime, formatCurrency } from '../utils/format'

export default function RateManagement() {
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newRate, setNewRate] = useState('')
  const [rateError, setRateError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchRates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getRates()
      setRates(data)
      setNewRate('')
    } catch (err) {
      setError(err?.message || 'Failed to load rates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRates() }, [fetchRates])

  const handleOpenConfirm = () => {
    const num = Number(newRate)
    if (!newRate || isNaN(num) || num <= 0) {
      setRateError('Rate must be a positive number.')
      return
    }
    setRateError('')
    setConfirm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateRates({ wholesale_rate_ugx: Number(newRate) })
      logAdminAction('rate_override', { wholesale_rate_ugx: Number(newRate) })
      setConfirm(false)
      await fetchRates()
    } catch {
      /* handled by interceptor */
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <TopBar title="Rate Management" onRefresh={fetchRates} refreshing={loading} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {loading && !rates ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : rates ? (
          <>
            {/* Current Rates Summary */}
            <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
              <h3 className="text-rowan-text font-bold mb-4">Wholesale Rate (UGX per USDC)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Average</p>
                  <p className="text-rowan-text text-lg font-bold">{formatCurrency(rates.avg_rate_ugx)}</p>
                </div>
                <div>
                  <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Minimum</p>
                  <p className="text-rowan-text text-lg font-bold">{formatCurrency(rates.min_rate_ugx)}</p>
                </div>
                <div>
                  <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Maximum</p>
                  <p className="text-rowan-text text-lg font-bold">{formatCurrency(rates.max_rate_ugx)}</p>
                </div>
              </div>
              {rates.updated_at && (
                <p className="text-rowan-muted text-xs mt-3">Last updated: {formatDateTime(rates.updated_at)}</p>
              )}
            </div>

            {/* Rate Override */}
            <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
              <h3 className="text-rowan-text font-bold mb-3">Override Wholesale Rate</h3>

              <div className="flex items-center gap-2 bg-rowan-orange/10 border border-rowan-orange/30 text-rowan-orange rounded-xl px-3 py-2 text-sm mb-4">
                <AlertTriangle size={14} />
                <span>This will update the wholesale rate for all active traders immediately.</span>
              </div>

              <div className="max-w-sm mb-4">
                <Input
                  label="New Wholesale Rate (UGX)"
                  type="number"
                  step="1"
                  value={newRate}
                  onChange={(e) => { setNewRate(e.target.value); setRateError('') }}
                  placeholder={String(Math.round(rates.avg_rate_ugx) || '')}
                  error={rateError}
                />
              </div>

              <Button
                disabled={!newRate}
                onClick={handleOpenConfirm}
              >
                Apply Rate
              </Button>
            </div>
          </>
        ) : null}

        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={handleSave}
          title="Apply Wholesale Rate"
          message={`You are about to set the wholesale rate to UGX ${Number(newRate).toLocaleString()} for all active traders. Are you sure?`}
          confirmLabel="Apply Rate"
          loading={saving}
        />
      </div>
    </>
  )
}
