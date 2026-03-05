import { useNavigate } from 'react-router-dom'
import { formatAddress, formatCurrency } from '../../utils/format'
import TraderStatusBadge from './TraderStatusBadge'
import FloatBar from './FloatBar'

export default function TraderRow({ trader }) {
  const navigate = useNavigate()

  return (
    <tr
      onClick={() => navigate(`/traders/${trader.id}`)}
      className="border-b border-rowan-border hover:bg-rowan-surface/50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-sm text-rowan-text font-medium">{trader.name || formatAddress(trader.id)}</td>
      <td className="px-4 py-3 text-sm text-rowan-muted">{trader.phone || '-'}</td>
      <td className="px-4 py-3"><TraderStatusBadge status={trader.status} /></td>
      <td className="px-4 py-3 text-sm text-rowan-text">{formatCurrency(trader.total_volume || 0)}</td>
      <td className="px-4 py-3 text-sm text-rowan-text">{trader.completed_count || 0}</td>
      <td className="px-4 py-3 w-32"><FloatBar current={trader.float_balance} limit={trader.float_limit} /></td>
    </tr>
  )
}
