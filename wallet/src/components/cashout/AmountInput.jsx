import { ArrowDownToLine, TrendingDown, TrendingUp } from 'lucide-react'
import { MIN_XLM_AMOUNT } from '../../utils/constants'

/**
 * Large XLM amount input with live fiat conversion.
 */
export default function AmountInput({
  xlmAmount,
  onAmountChange,
  fiatAmount,
  currency,
  rate,
  fee,
  netFiat,
}) {
  const handleChange = (e) => {
    const val = e.target.value
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      onAmountChange(val)
    }
  }

  return (
    <div className="py-4">
      <div className="text-center">
        <input
          type="text"
          inputMode="decimal"
          value={xlmAmount}
          onChange={handleChange}
          placeholder="0.00"
          className="bg-transparent text-rowan-text text-5xl font-bold tabular-nums text-center w-full focus:outline-none"
        />
        <p className="text-rowan-muted text-sm mt-1">XLM</p>
      </div>

      <ArrowDownToLine size={20} className="text-rowan-muted mx-auto my-3" />

      <div className="text-center">
        <p className="text-rowan-yellow text-2xl font-bold tabular-nums">
          {fiatAmount ? Number(fiatAmount).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'}
        </p>
        <p className="text-rowan-muted text-sm">{currency || 'UGX'}</p>
      </div>

      <div className="flex justify-between text-xs text-rowan-muted mt-3 px-2">
        <span>Rate: 1 XLM = {rate ? Number(rate).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '...'}</span>
        <span>Fee: {fee || '0'} XLM</span>
      </div>
      <div className="flex justify-between text-xs text-rowan-muted mt-1 px-2">
        <span>You receive: {netFiat ? Number(netFiat).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'} {currency || ''}</span>
      </div>

      <div className="flex justify-between text-xs mt-1 px-2">
        <span className="flex items-center gap-1 text-rowan-muted">
          <TrendingDown size={12} />
          {MIN_XLM_AMOUNT} XLM minimum
        </span>
        <span className="flex items-center gap-1 text-rowan-muted">
          <TrendingUp size={12} />
          Based on KYC tier
        </span>
      </div>
    </div>
  )
}
