import P2pHistoryCard from './P2pHistoryCard'
import UtilityHistoryCard from './UtilityHistoryCard'

export default function HistoryItemCard({ transaction }) {
  if (transaction?.kind === 'utility') {
    return <UtilityHistoryCard transaction={transaction} />
  }
  return <P2pHistoryCard transaction={transaction} />
}
