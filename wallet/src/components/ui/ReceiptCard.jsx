import { forwardRef } from 'react'
import { CircleCheckBig } from 'lucide-react'
import NetworkBadge from './NetworkBadge'
import ReceiptRow from './ReceiptRow'
import { formatXlm, formatCurrency, formatDateTime, formatAddress } from '../../utils/format'
import { NETWORKS } from '../../utils/constants'

/**
 * ReceiptCard — receipt-style card for completed transactions.
 * Uses forwardRef so html2canvas can capture the DOM node.
 */
const ReceiptCard = forwardRef(function ReceiptCard({ receipt }, ref) {
  if (!receipt) return null

  const network = NETWORKS[receipt.network] || {}
  const fiatCurrency = receipt.fiatCurrency || network.currency || 'UGX'

  return (
    <div
      ref={ref}
      className="bg-rowan-surface rounded-2xl border border-rowan-border overflow-hidden"
    >
      {/* Header */}
      <div className="bg-rowan-green/10 px-5 py-4 flex flex-col items-center gap-2">
        <CircleCheckBig size={32} className="text-rowan-green" />
        <h3 className="text-rowan-text text-base font-bold">Payment Complete</h3>
        <NetworkBadge />
      </div>

      {/* Body */}
      <div className="px-5 py-3">
        {/* Amounts highlight */}
        <div className="flex items-center justify-between py-3 mb-1">
          <div className="text-center flex-1">
            <p className="text-rowan-muted text-[10px] uppercase tracking-wide">Sent</p>
            <p className="text-rowan-text text-lg font-bold mt-0.5">
              {formatXlm(receipt.xlmAmount)}
            </p>
          </div>
          <span className="text-rowan-muted text-lg mx-2">&rarr;</span>
          <div className="text-center flex-1">
            <p className="text-rowan-muted text-[10px] uppercase tracking-wide">Received</p>
            <p className="text-rowan-green text-lg font-bold mt-0.5">
              {formatCurrency(receipt.fiatAmount, fiatCurrency)}
            </p>
          </div>
        </div>

        {/* Detail rows */}
        <ReceiptRow label="Network" value={network.label || receipt.network} />
        <ReceiptRow label="Transaction ID" value={formatAddress(receipt.id)} mono />
        {receipt.stellarTxHash && (
          <ReceiptRow label="Stellar TX" value={formatAddress(receipt.stellarTxHash)} mono />
        )}
        {receipt.escrowAddress && (
          <ReceiptRow label="Escrow" value={formatAddress(receipt.escrowAddress)} mono />
        )}
        {receipt.memo && <ReceiptRow label="Memo" value={receipt.memo} />}
        <ReceiptRow
          label="Rate"
          value={receipt.rate ? `1 XLM = ${fiatCurrency} ${Number(receipt.rate).toLocaleString()}` : undefined}
        />
        <ReceiptRow label="Completed" value={formatDateTime(receipt.completedAt)} />
      </div>

      {/* Footer branding */}
      <div className="border-t border-dashed border-rowan-border px-5 py-3 text-center">
        <p className="text-rowan-muted text-[10px]">Powered by Rowan</p>
      </div>
    </div>
  )
})

export default ReceiptCard
