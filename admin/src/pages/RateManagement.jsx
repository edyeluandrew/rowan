import { useState, useEffect, useCallback } from 'react'
import TopBar from '../components/layout/TopBar'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { AlertTriangle } from 'lucide-react'
import { getRates, updateRates, logAdminAction } from '../api/system'
import { formatDateTime } from '../utils/format'
import { RATE_MIN } from '../utils/constants'

export default function RateManagement() {
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [rateErrors, setRateErrors] = useState({})
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchRates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getRates()
      setRates(data)
      setOverrides({})
    } catch (err) {
      setError(err?.message || 'Failed to load rates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRates() }, [fetchRates])

  const handleOpenConfirm = () => {
    const errors = {}
    for (const [pair, val] of Object.entries(overrides)) {
      const num = Number(val)
      if (isNaN(num) || num <= RATE_MIN) {
        errors[pair] = 'Rate must be a positive number.'
      }
    }
    if (Object.keys(errors).length > 0) {
      setRateErrors(errors)
      return
    }
    setRateErrors({})
    setConfirm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateRates(overrides)
      logAdminAction('rate_override', { rates: overrides })
      setConfirm(false)
      await fetchRates()
    } catch {
      /* handled by interceptor */
    } finally {
      setSaving(false)
    }
  }

  const hasOverrides = Object.keys(overrides).length > 0

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
            {/* Current Rates */}
            <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
              <h3 className="text-rowan-text font-bold mb-4">Current Rates</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {rates.current && Object.entries(rates.current).map(([pair, rate]) => (
                  <div key={pair}>
                    <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">{pair}</p>
                    <p className="text-rowan-text text-lg font-bold">{Number(rate).toFixed(4)}</p>
                  </div>
                ))}
              </div>
              {rates.last_updated && (
                <p className="text-rowan-muted text-xs mt-3">Last updated: {formatDateTime(rates.last_updated)}</p>
              )}
            </div>

            {/* Rate Overrides */}
            <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
              <h3 className="text-rowan-text font-bold mb-3">Rate Overrides</h3>

              <div className="flex items-center gap-2 bg-rowan-orange/10 border border-rowan-orange/30 text-rowan-orange rounded-xl px-3 py-2 text-sm mb-4">
                <AlertTriangle size={14} />
                <span>Rate overrides affect all active transactions. Use with caution.</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {rates.current && Object.keys(rates.current).map((pair) => (
                  <Input
                    key={pair}
                    label={pair}
                    type="number"
                    step="0.0001"
                    value={overrides[pair] !== undefined ? overrides[pair] : ''}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '') {
                        const next = { ...overrides }
                        delete next[pair]
                        setOverrides(next)
                      } else {
                        setOverrides({ ...overrides, [pair]: val })
                      }
                      setRateErrors((prev) => { const next = { ...prev }; delete next[pair]; return next })
                    }}
                    placeholder={String(rates.current[pair])}
                    error={rateErrors[pair]}
                  />
                ))}
              </div>

              <Button
                disabled={!hasOverrides}
                onClick={handleOpenConfirm}
              >
                Apply Overrides
              </Button>
            </div>

            {/* Rate History */}
            {rates.history && rates.history.length > 0 && (
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <h3 className="text-rowan-text font-bold mb-4">Rate History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-rowan-border text-rowan-muted text-xs uppercase tracking-wider">
                        <th className="text-left px-4 py-2 font-medium">Pair</th>
                        <th className="text-left px-4 py-2 font-medium">Rate</th>
                        <th className="text-left px-4 py-2 font-medium">Source</th>
                        <th className="text-left px-4 py-2 font-medium">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates.history.map((entry, i) => (
                        <tr key={i} className="border-b border-rowan-border/50">
                          <td className="px-4 py-2 text-sm text-rowan-text">{entry.pair}</td>
                          <td className="px-4 py-2 text-sm text-rowan-text">{Number(entry.rate).toFixed(4)}</td>
                          <td className="px-4 py-2 text-sm text-rowan-muted">{entry.source || '-'}</td>
                          <td className="px-4 py-2 text-sm text-rowan-muted">{formatDateTime(entry.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}

        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={handleSave}
          title="Apply Rate Overrides"
          message={`You are about to override ${Object.keys(overrides).length} rate(s). This will affect all active and new transactions immediately. Are you sure?`}
          confirmLabel="Apply Overrides"
          loading={saving}
        />
      </div>
    </>
  )
}
