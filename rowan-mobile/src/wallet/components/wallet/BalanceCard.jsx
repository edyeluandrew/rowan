import { useEffect, useState } from 'react'
import { Wallet, RefreshCw, Eye, EyeOff, ChevronDown } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import { getPreference, setPreference } from '../../utils/storage'

const PREF_UNIT = 'rowan_balance_display_unit'
const PREF_HIDDEN = 'rowan_balance_hidden'

/**
 * Balance card — primary amount + currency dropdown on the right, hide/reveal.
 */
export default function BalanceCard({
  fiatAmount,
  fiatCurrency,
  usdcBalance,
  loading,
  refreshing,
  onRefresh,
}) {
  const [unit, setUnit] = useState('usdc') // 'usdc' | 'fiat'
  const [hidden, setHidden] = useState(false)
  const [prefsReady, setPrefsReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [savedUnit, savedHidden] = await Promise.all([
          getPreference(PREF_UNIT),
          getPreference(PREF_HIDDEN),
        ])
        if (cancelled) return
        if (savedUnit === 'usdc' || savedUnit === 'fiat') setUnit(savedUnit)
        if (savedHidden === 'true') setHidden(true)
      } catch {
        // defaults
      } finally {
        if (!cancelled) setPrefsReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const selectUnit = async (next) => {
    setUnit(next)
    await setPreference(PREF_UNIT, next)
  }

  const toggleHidden = async () => {
    const next = !hidden
    setHidden(next)
    await setPreference(PREF_HIDDEN, String(next))
  }

  const fiatDigits = fiatCurrency === 'KES' ? 2 : 0
  const usdcLabel = usdcBalance != null
    ? Number(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
  const fiatLabel = fiatAmount != null
    ? Number(fiatAmount).toLocaleString('en-US', { maximumFractionDigits: fiatDigits })
    : '—'

  const primaryValue = unit === 'usdc' ? usdcLabel : fiatLabel
  const secondaryLine = unit === 'usdc'
    ? (fiatAmount != null ? `≈ ${fiatLabel} ${fiatCurrency}` : null)
    : (usdcBalance != null ? `${usdcLabel} USDC in wallet` : null)

  const showMasked = hidden && prefsReady
  const selectValue = unit === 'usdc' ? 'usdc' : 'fiat'

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-5 mb-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-rowan-muted" />
          <span className="text-rowan-muted text-xs uppercase tracking-wider">Balance</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleHidden}
            className="text-rowan-muted p-1 min-h-9 min-w-9 flex items-center justify-center"
            aria-label={hidden ? 'Show balance' : 'Hide balance'}
          >
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="text-rowan-muted p-1 min-h-9 min-w-9 flex items-center justify-center"
            aria-label="Refresh balance"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && fiatAmount == null && usdcBalance == null ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner size={24} />
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="text-rowan-text text-4xl font-bold tabular-nums tracking-tight min-w-0 truncate">
              {showMasked ? '••••••' : primaryValue}
            </span>
            <div className="relative shrink-0 mb-1">
              <select
                value={selectValue}
                onChange={(e) => selectUnit(e.target.value)}
                className="appearance-none bg-rowan-bg border border-rowan-border rounded-lg pl-3 pr-8 py-2 text-rowan-green text-sm font-semibold focus:outline-none focus:border-rowan-green min-h-9"
                aria-label="Display currency"
              >
                <option value="usdc">USDC</option>
                <option value="fiat">{fiatCurrency || 'Fiat'}</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-rowan-muted pointer-events-none"
              />
            </div>
          </div>
          {secondaryLine && (
            <p className="text-rowan-muted text-sm tabular-nums mt-2">
              {showMasked ? '••••' : secondaryLine}
            </p>
          )}
          {unit === 'fiat' && !showMasked && (
            <p className="text-rowan-muted text-[10px] mt-1">Indicative · from live rate</p>
          )}
        </>
      )}
    </div>
  )
}
