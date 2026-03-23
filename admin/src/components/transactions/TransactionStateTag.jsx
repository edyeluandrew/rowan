import { TRANSACTION_STATES } from '../../utils/constants'
import Badge from '../ui/Badge'

export default function TransactionStateTag({ state }) {
  const stateConfig = TRANSACTION_STATES[state] || { label: state, color: 'text-rowan-muted', bg: 'bg-rowan-muted/10' }
  return <Badge color={stateConfig.color} bg={stateConfig.bg}>{stateConfig.label}</Badge>
}
