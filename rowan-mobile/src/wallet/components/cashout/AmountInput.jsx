import { ArrowDownToLine } from 'lucide-react'

/**
 * Fiat-first amount input with live XLM estimate below.
 */
export default function AmountInput({
  fiatAmount,
  onFiatAmountChange,
  currency,
  xlmEstimate,
  platformFeeFiat,
  maxFiat,
}) {
  const handleChange = (e) => {
    const val = e.target.value
    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
      onFiatAmountChange(val)
    }
  }

  const netFiat = parseFloat(fiatAmount) || 0

  return (
    <div className="py-4">
      <div className="text-center">
        <input
          type="text"
          inputMode="decimal"
          value={fiatAmount}
          onChange={handleChange}
          placeholder="0"
          className="bg-transparent text-rowan-text text-5xl font-bold tabular-nums text-center w-full focus:outline-none"
        />
        <p className="text-rowan-muted text-sm mt-1">{currency || 'UGX'} you receive</p>
      </div>

      <ArrowDownToLine size={20} className="text-rowan-muted mx-auto my-3" />

      <div className="text-center">
        <p className="text-rowan-yellow text-2xl font-bold tabular-nums">
          {xlmEstimate > 0 ? Number(xlmEstimate).toFixed(4) : '—'}
        </p>
        <p className="text-rowan-muted text-sm">XLM to send (estimate)</p>
      </div>

      {maxFiat != null && maxFiat > 0 && (
        <p className="text-rowan-muted text-xs text-center mt-3">
          Max ~{Math.floor(maxFiat).toLocaleString()} {currency}
        </p>
      )}

      {platformFeeFiat > 0 && netFiat > 0 && (
        <p className="text-rowan-muted text-xs text-center mt-1">
          Includes ~{Math.ceil(platformFeeFiat).toLocaleString()} {currency} platform fee
        </p>
      )}
    </div>
  )
}
