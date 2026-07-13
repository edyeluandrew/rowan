import { Navigate, useLocation } from 'react-router-dom'

/** Legacy route — P2P hub owns Buy/Sell listings. */
export default function Marketplace() {
  const location = useLocation()
  const tab = location.state?.tab === 'sell' ? 'sell' : 'buy'
  return <Navigate to="/wallet/p2p" replace state={{ tab }} />
}
