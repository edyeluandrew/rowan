import { useEffect, useState } from 'react'
import { RefreshCw, Eye, EyeOff, ChevronDown } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import { getPreference, setPreference } from '../../utils/storage'

const PREF_UNIT = 'rowan_balance_display_unit'
const PREF_HIDDEN = 'rowan_balance_hidden'

/**
 * Balance hero — brand green panel, large serif amount.
 * Logic unchanged: unit toggle, hide, refresh, locked USDC.
 */
export default function BalanceCard({
  fiatAmount,
  fiatCurrency,
  usdcBalance,
  usdcAvailable,
  usdcLocked,
  loading,
  refreshing,
  onRefresh,
}) {
  const [unit, setUnit] = useState('usdc')
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

  const displayUsdc = usdcAvailable ?? usdcBalance
  const locked = usdcLocked != null ? Number(usdcLocked) : 0
  const fiatDigits = fiatCurrency === 'KES' ? 2 : 0
  const usdcLabel = displayUsdc != null
    ? Number(displayUsdc).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
  const totalUsdcLabel = usdcBalance != null
    ? Number(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null
  const fiatLabel = fiatAmount != null
    ? Number(fiatAmount).toLocaleString('en-US', { maximumFractionDigits: fiatDigits })
    : '—'

  const primaryValue = unit === 'usdc' ? usdcLabel : fiatLabel
  const primaryUnit = unit === 'usdc' ? 'USDC' : (fiatCurrency || '')
  const secondaryLine = unit === 'usdc'
    ? (fiatAmount != null ? `≈ ${fiatLabel} ${fiatCurrency}` : null)
    : (displayUsdc != null ? `${usdcLabel} USDC available` : null)

  const showMasked = hidden && prefsReady
  const selectValue = unit === 'usdc' ? 'usdc' : 'fiat'

  return (
    <div className="relative overflow-hidden bg-brand-hero text-white rounded-[1.75rem] p-5 mb-4 shadow-lift">
      <div className="absolute inset-0 rowan-dot-grid opacity-60 pointer-events-none" />
      <div className="relative z-10">
        <div className="flex justify-between items-center">
          <span className="text-white/60 text-[10px] uppercase tracking-[0.18em] font-sans">
            Available balance
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={toggleHidden}
              className="text-white/70 p-1 min-h-9 min-w-9 flex items-center justify-center"
              aria-label={hidden ? 'Show balance' : 'Hide balance'}
            >
              {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="text-white/70 p-1 min-h-9 min-w-9 flex items-center justify-center"
              aria-label="Refresh balance"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading && fiatAmount == null && usdcBalance == null ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size={24} />
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="font-serif text-4xl sm:text-5xl tabular-nums tracking-tight truncate leading-none">
                  {showMasked ? '••••••' : primaryValue}
                </p>
                {!showMasked && primaryUnit && (
                  <p className="text-rowan-lime/90 text-sm font-semibold mt-2 font-sans tracking-wide">
                    {primaryUnit}
                  </p>
                )}
              </div>
              <div className="relative shrink-0 mb-1">
                <select
                  value={selectValue}
                  onChange={(e) => selectUnit(e.target.value)}
                  className="appearance-none bg-white/10 border border-white/20 rounded-full pl-3 pr-8 py-2 text-white text-xs font-semibold focus:outline-none focus:border-rowan-lime min-h-9 backdrop-blur-sm"
                  aria-label="Display currency"
                >
                  <option value="usdc" className="text-rowan-text">USDC</option>
                  <option value="fiat" className="text-rowan-text">{fiatCurrency || 'Fiat'}</option>
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none"
                />
              </div>
            </div>
            {secondaryLine && (
              <p className="text-white/55 text-sm tabular-nums mt-3 font-sans">
                {showMasked ? '••••' : secondaryLine}
              </p>
            )}
            {!showMasked && locked > 0.0000001 && unit === 'usdc' && (
              <p className="text-white/45 text-xs tabular-nums mt-1.5 font-sans">
                {locked.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC locked
                {totalUsdcLabel ? ` · ${totalUsdcLabel} total` : ''}
              </p>
            )}
            {unit === 'fiat' && !showMasked && (
              <p className="text-white/40 text-[10px] mt-1 font-sans">Indicative · from live rate</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
