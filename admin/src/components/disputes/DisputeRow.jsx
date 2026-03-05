import { useNavigate } from 'react-router-dom'
import { formatDateTime, formatAddress } from '../../utils/format'
import DisputePriorityBadge from './DisputePriorityBadge'
import TransactionStateTag from '../transactions/TransactionStateTag'

export default function DisputeRow({ dispute }) {
  const navigate = useNavigate()

  return (
    <tr
      onClick={() => navigate(`/disputes/${dispute.id}`)}
      className="border-b border-rowan-border hover:bg-rowan-surface/50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-sm text-rowan-muted font-mono">{formatAddress(dispute.id)}</td>
      <td className="px-4 py-3 text-sm text-rowan-text">{dispute.reason || '-'}</td>
      <td className="px-4 py-3"><DisputePriorityBadge priority={dispute.priority} /></td>
      <td className="px-4 py-3"><TransactionStateTag state={dispute.status || 'open'} /></td>
      <td className="px-4 py-3 text-sm text-rowan-muted">{formatDateTime(dispute.created_at)}</td>
    </tr>
  )
}
