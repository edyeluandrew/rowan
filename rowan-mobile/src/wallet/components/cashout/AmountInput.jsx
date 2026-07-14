import { ArrowDownToLine } from 'lucide-react'

/**
 * Fiat-first amount input with live crypto estimate below.
 */
export default function AmountInput({
  fiatAmount,
  onFiatAmountChange,
  currency,
  xlmEstimate,
  cryptoEstimate,
  cryptoLabel = 'USDC',
  fiatSubLabel,
  platformFeeFiat: _platformFeeFiat,
  maxFiat: _maxFiat,
}) {
  const handleChange = (e) => {
    const val = e.target.value
    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
      onFiatAmountChange(val)
    }
  }

  const estimate = cryptoEstimate ?? xlmEstimate
  const estimateDecimals = 4
  const fiatCaption = fiatSubLabel ?? (currency || 'UGX')
  const estimateCaption = cryptoEstimate != null ? cryptoLabel : 'USDC'

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
    </div>
  )
}
