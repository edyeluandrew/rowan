import { useSocketContext } from '../../context/SocketContext'
import { Wifi, WifiOff } from 'lucide-react'

/**
 * Live connection status indicator dot.
 */
export default function ConnectionDot() {
  const { connectionStatus } = useSocketContext()
  const online = connectionStatus !== 'offline'

  return (
    <div className="relative flex items-center" title={online ? 'Online' : 'Offline'}>
      {online ? (
        <>
          <Wifi size={14} className="text-rowan-green" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rowan-green rounded-full animate-pulse-dot" />
        </>
      ) : (
        <WifiOff size={14} className="text-rowan-red" />
      )}
    </div>
  )
}
