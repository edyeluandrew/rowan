import { sanitizeAmount } from '../../utils/sanitizeAmount'

/**
 * Boxed amount field. Letters are ignored. A live estimate sits under the box.
 */
export default function AmountInput({
  fiatAmount,
  onFiatAmountChange,
  currency,
  xlmEstimate,
  cryptoEstimate,
  cryptoLabel = 'USDC',
  fiatSubLabel,
  platformFeeFiat,
  feeHint,
  maxFiat: _maxFiat,
  label = 'Amount',
}) {
  const handleChange = (e) => {
    onFiatAmountChange(sanitizeAmount(e.target.value, { decimals: 2 }))
  }

  const estimate = cryptoEstimate ?? xlmEstimate
  const unit = fiatSubLabel || currency || 'UGX'
  const estimateCaption = cryptoEstimate != null ? cryptoLabel : 'USDC'

  return (
    <div>
      <label htmlFor="rowan-amount" className="mb-2 block text-xs font-medium uppercase tracking-wider text-rowan-muted">
        {label}
      </label>
      <div className="flex min-h-14 items-center rounded-2xl border border-rowan-border bg-rowan-surface focus-within:border-rowan-yellow">
        <input
          id="rowan-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          value={fiatAmount}
          onChange={handleChange}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-2xl font-semibold tabular-nums text-rowan-text outline-none placeholder:text-rowan-muted/40"
        />
        <span className="pr-4 text-sm font-semibold text-rowan-muted">{unit}</span>
      </div>

      <p className="mt-3 text-sm text-rowan-muted">
        About{' '}
        <span className="font-semibold tabular-nums text-rowan-text">
          {estimate > 0 ? Number(estimate).toFixed(4) : '—'}
        </span>
        {' '}{estimateCaption}
      </p>

      {feeHint ? (
        <p className="mt-1 text-xs text-rowan-muted">{feeHint}</p>
      ) : Number(platformFeeFiat) > 0 && currency ? (
        <p className="mt-1 text-xs text-rowan-muted">
          Rowan fee {Number(platformFeeFiat).toLocaleString('en-US', { maximumFractionDigits: 0 })} {currency}
        </p>
      ) : null}
    </div>
  )
}
