import { Navigate } from 'react-router-dom'

/** Legacy route — Add money is P2P buy via marketplace. */
export default function AddMoney() {
  return <Navigate to="/wallet/marketplace" replace state={{ tab: 'buy' }} />
}
