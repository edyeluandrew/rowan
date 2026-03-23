import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Bell, AlertTriangle, Clock } from 'lucide-react'
import useRateAlerts from '../hooks/useRateAlerts'
import useRates from '../hooks/useRates'
import RateAlertCard from '../components/alerts/RateAlertCard'
import CreateAlertSheet from '../components/alerts/CreateAlertSheet'
import Button from '../components/ui/Button'

/**
 * Rate Alerts page — list, create, toggle, delete alerts.
 */
export default function RateAlerts() {
  const navigate = useNavigate()
  const { alerts, loading, error, creating, create, remove, toggle, fetch } = useRateAlerts()
  const { allRates } = useRates()
  const [sheetOpen, setSheetOpen] = useState(false)

  /** Map a pair like "XLM/UGX" to the current rate from allRates */
  const getCurrentRate = (pair) => {
    if (!allRates || !pair) return null
    const key = pair.replace('/', '_').toLowerCase()
    return allRates[key] ?? null
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-rowan-text text-lg font-bold">Rate Alerts</h1>
        </div>
        <button
          onClick={() => setSheetOpen(true)}
          className="text-rowan-yellow min-h-11 min-w-11 flex items-center justify-center"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Current rates strip */}
      {allRates && (
        <div className="flex gap-2 overflow-x-auto mb-6 pb-1 -mx-1 px-1">
          {(Array.isArray(allRates)
            ? allRates.map((r) => [r.network, r.rate])
            : Object.entries(allRates)
          ).map(([key, value]) => (
            <div
              key={key}
              className="bg-rowan-surface border border-rowan-border rounded-lg px-3 py-2 text-center flex-shrink-0"
            >
              <p className="text-rowan-muted text-[10px] uppercase">{String(key).replace('_', '/')}</p>
              <p className="text-rowan-text text-sm font-mono tabular-nums">{Number(value)?.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Clock size={20} className="text-rowan-muted animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-rowan-surface border border-rowan-red/30 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="text-rowan-red mx-auto mb-3" />
          <p className="text-rowan-muted text-sm">{error}</p>
          <button onClick={fetch} className="text-rowan-yellow text-sm underline mt-2">
            Retry
          </button>
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-rowan-surface rounded-xl p-8 text-center">
          <Bell size={32} className="text-rowan-muted mx-auto mb-3" />
          <p className="text-rowan-muted text-sm">No rate alerts yet</p>
          <p className="text-rowan-muted text-xs mt-1">
            Get notified when exchange rates hit your target
          </p>
          <div className="mt-4">
            <Button onClick={() => setSheetOpen(true)}>
              <Plus size={16} className="mr-2" />
              Create Alert
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <RateAlertCard
              key={alert.id}
              alert={alert}
              currentRate={getCurrentRate(alert.pair)}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </div>
      )}

      <CreateAlertSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={create}
        creating={creating}
      />
    </div>
  )
}
