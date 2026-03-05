import { TRADER_STATUSES } from '../../utils/constants'
import Badge from '../ui/Badge'

export default function TraderStatusBadge({ status }) {
  const config = TRADER_STATUSES[status] || { label: status, color: 'text-rowan-muted', bg: 'bg-rowan-muted/10' }
  return <Badge color={config.color} bg={config.bg}>{config.label}</Badge>
}
