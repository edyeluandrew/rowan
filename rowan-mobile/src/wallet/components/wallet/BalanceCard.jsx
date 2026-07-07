import { Wallet, RefreshCw, ChevronDown } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import { FIAT_OPTIONS } from '../../utils/fiat'

/**
 * Fiat-first balance card with USDC primary balance.
 */
export default function BalanceCard({
  fiatAmount,
  fiatCurrency,
  usdcBalance,
  loading,
  refreshing,
  onRefresh,
  onFiatCurrencyChange,
}) {
  const selected = FIAT_OPTIONS.find((o) => o.code === fiatCurrency) || FIAT_OPTIONS[0]

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-5 mb-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-rowan-muted" />
          <span className="text-rowan-muted text-xs uppercase tracking-wider">Total balance</span>
        </div>
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

      {loading && fiatAmount == null && usdcBalance == null ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner size={24} />
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-rowan-text text-4xl font-bold tabular-nums">
                  {fiatAmount != null
                    ? Number(fiatAmount).toLocaleString('en-US', {
                        maximumFractionDigits: fiatCurrency === 'KES' ? 2 : 0,
                      })
                    : '—'}
                </span>
                {onFiatCurrencyChange ? (
                  <div className="relative">
                    <select
                      value={fiatCurrency}
                      onChange={(e) => onFiatCurrencyChange(e.target.value)}
                      className="appearance-none bg-rowan-bg border border-rowan-border rounded-lg pl-2 pr-7 py-1 text-rowan-yellow text-sm font-semibold focus:outline-none focus:border-rowan-yellow min-h-9"
                      aria-label="Display currency"
                    >
                      {FIAT_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.flag} {opt.code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-rowan-muted pointer-events-none"
                    />
                  </div>
                ) : (
                  <span className="text-rowan-yellow text-lg font-semibold">{fiatCurrency}</span>
                )}
              </div>
              <p className="text-rowan-muted text-xs mt-1">
                Indicative value · {selected.label}
              </p>
            </div>
          </div>

          {usdcBalance != null && (
            <p className="text-rowan-muted text-sm tabular-nums mt-3 pt-3 border-t border-rowan-border">
              {Number(usdcBalance).toFixed(2)} USDC in wallet
            </p>
          )}
        </>
      )}
    </div>
  )
}
