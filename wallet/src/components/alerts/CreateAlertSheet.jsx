import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import { ALERT_DIRECTIONS, ALERT_CURRENCIES } from '../../utils/constants'

/**
 * Bottom sheet form to create a new rate alert.
 */
export default function CreateAlertSheet({ open, onClose, onCreate, creating }) {
  const [pair, setPair] = useState(ALERT_CURRENCIES[0])
  const [direction, setDirection] = useState('ABOVE')
  const [targetRate, setTargetRate] = useState('')
  const [error, setError] = useState(null)

  const handleCreate = async () => {
    setError(null)
    const rate = parseFloat(targetRate)
    if (!rate || rate <= 0) {
      setError('Enter a valid target rate')
      return
    }
    try {
      await onCreate({ pair, direction, targetRate: rate })
      setTargetRate('')
      setError(null)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create alert')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="New Rate Alert">
      <div className="space-y-4">
        {/* Currency pair */}
        <div>
          <label className="text-rowan-muted text-xs uppercase tracking-wider block mb-2">
            Currency pair
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ALERT_CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setPair(c)}
                className={`border rounded-lg p-3 text-sm text-center min-h-11 ${
                  pair === c
                    ? 'border-rowan-yellow text-rowan-yellow bg-rowan-yellow/10'
                    : 'border-rowan-border text-rowan-muted bg-rowan-bg'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Direction */}
        <div>
          <label className="text-rowan-muted text-xs uppercase tracking-wider block mb-2">
            Alert when rate
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ALERT_DIRECTIONS).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => setDirection(key)}
                className={`border rounded-lg p-3 text-sm text-center min-h-11 ${
                  direction === key
                    ? 'border-rowan-yellow text-rowan-yellow bg-rowan-yellow/10'
                    : 'border-rowan-border text-rowan-muted bg-rowan-bg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Target rate */}
        <div>
          <label className="text-rowan-muted text-xs uppercase tracking-wider block mb-2">
            Target rate
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={targetRate}
            onChange={(e) => setTargetRate(e.target.value)}
            placeholder="e.g. 4200"
            className="w-full bg-rowan-bg border border-rowan-border rounded-xl px-4 py-3 text-rowan-text text-sm placeholder:text-rowan-muted/50 outline-none focus:border-rowan-yellow min-h-11"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-rowan-red" />
            <p className="text-rowan-red text-xs">{error}</p>
          </div>
        )}

        <Button onClick={handleCreate} loading={creating}>
          Create Alert
        </Button>
      </div>
    </BottomSheet>
  )
}
