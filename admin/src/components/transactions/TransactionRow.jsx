import { useNavigate } from 'react-router-dom'
import { formatUsdc, formatDateTime, formatAddress } from '../../utils/format'
import TransactionStateTag from './TransactionStateTag'

export default function TransactionRow({ tx }) {
  const navigate = useNavigate()

  return (
    <tr
      onClick={() => navigate(`/transactions/${tx.id}`)}
      className="border-b border-rowan-border hover:bg-rowan-surface/50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-sm text-rowan-muted font-mono">{formatAddress(tx.id)}</td>
      <td className="px-4 py-3 text-sm text-rowan-text">{tx.usdc_amount ? `${formatUsdc(tx.usdc_amount)} USDC` : `${formatUsdc(tx.fiat_amount)} ${tx.fiat_currency || ''}`}</td>
      <td className="px-4 py-3 text-sm text-rowan-text">{tx.fiat_currency || '-'}</td>
      <td className="px-4 py-3"><TransactionStateTag state={tx.state} /></td>
      <td className="px-4 py-3 text-sm text-rowan-muted">{tx.trader_name || formatAddress(tx.trader_id || '')}</td>
      <td className="px-4 py-3 text-sm text-rowan-muted">{formatDateTime(tx.created_at)}</td>
    </tr>
  )
}
