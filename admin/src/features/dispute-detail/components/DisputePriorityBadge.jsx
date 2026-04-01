import { DISPUTE_PRIORITIES } from '../../../shared/utils/constants'
import Badge from '../../../shared/components/ui/Badge'

export default function DisputePriorityBadge({ priority }) {
  const config = DISPUTE_PRIORITIES[priority] || { label: priority, color: 'text-rowan-muted', bg: 'bg-rowan-muted/10' }
  return <Badge color={config.color} bg={config.bg}>{config.label}</Badge>
}
