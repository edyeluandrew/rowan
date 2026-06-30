import { ArrowDownToLine } from 'lucide-react'

/**
 * Fiat-first amount input with live crypto estimate below (XLM for sell, USDC for buy).
 */
export default function AmountInput({
  fiatAmount,
  onFiatAmountChange,
  currency,
  xlmEstimate,
  cryptoEstimate,
  cryptoLabel = 'USDC you receive (estimate)',
  fiatSubLabel,
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
  const estimate = cryptoEstimate ?? xlmEstimate
  const estimateDecimals = cryptoEstimate != null ? 4 : 4
  const estimateCaption = cryptoEstimate != null ? cryptoLabel : 'XLM to send (estimate)'
  const fiatCaption = fiatSubLabel ?? `${currency || 'UGX'} you receive`

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
        <p className="text-rowan-muted text-sm mt-1">{fiatCaption}</p>
      </div>

      <ArrowDownToLine size={20} className="text-rowan-muted mx-auto my-3" />

      <div className="text-center">
        <p className="text-rowan-yellow text-2xl font-bold tabular-nums">
          {estimate > 0 ? Number(estimate).toFixed(estimateDecimals) : '—'}
        </p>
        <p className="text-rowan-muted text-sm">{estimateCaption}</p>
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
