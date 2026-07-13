import { useEffect, useState } from 'react'
import { Wallet, RefreshCw, Eye, EyeOff } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import { getPreference, setPreference } from '../../utils/storage'

const PREF_UNIT = 'rowan_balance_display_unit'
const PREF_HIDDEN = 'rowan_balance_hidden'

/**
 * Balance card with USDC/fiat toggle and hide/reveal.
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
  const primarySuffix = unit === 'usdc' ? 'USDC' : (fiatCurrency || '')
  const secondaryLine = unit === 'usdc'
    ? (fiatAmount != null ? `≈ ${fiatLabel} ${fiatCurrency}` : null)
    : (usdcBalance != null ? `${usdcLabel} USDC in wallet` : null)

  const showMasked = hidden && prefsReady

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

      {/* Unit toggle */}
      <div className="mt-3 inline-flex bg-rowan-bg border border-rowan-border rounded-xl p-1">
        <button
          type="button"
          onClick={() => selectUnit('usdc')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-9 ${
            unit === 'usdc' ? 'bg-rowan-yellow text-rowan-bg' : 'text-rowan-muted'
          }`}
        >
          USDC
        </button>
        <button
          type="button"
          onClick={() => selectUnit('fiat')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-9 ${
            unit === 'fiat' ? 'bg-rowan-yellow text-rowan-bg' : 'text-rowan-muted'
          }`}
        >
          {fiatCurrency || 'Fiat'}
        </button>
      </div>

      {loading && fiatAmount == null && usdcBalance == null ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner size={24} />
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-2 flex-wrap">
            <span className="text-rowan-text text-4xl font-bold tabular-nums tracking-tight">
              {showMasked ? '••••••' : primaryValue}
            </span>
            {!showMasked && (
              <span className="text-rowan-yellow text-lg font-semibold">{primarySuffix}</span>
            )}
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
