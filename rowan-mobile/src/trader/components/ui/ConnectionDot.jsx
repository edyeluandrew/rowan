import { useSocket } from '../../context/SocketContext';

export default function ConnectionDot() {
  const { isConnected } = useSocket();
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2.5 h-2.5 rounded-full ${
          isConnected ? 'bg-rowan-green animate-pulse-dot' : 'bg-rowan-red'
        }`}
      />
      {!isConnected && (
        <span className="text-rowan-red text-xs">Offline</span>
      )}
    </div>
  );
}
