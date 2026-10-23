import { useSocket } from '../../context/SocketContext';

export default function ConnectionDot() {
  const { connectionStatus } = useSocket();
  const offline = connectionStatus === 'offline';
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2.5 h-2.5 rounded-full ${
          offline ? 'bg-rowan-red' : 'bg-rowan-green animate-pulse-dot'
        }`}
      />
      {offline && (
        <span className="text-rowan-red text-xs">Offline</span>
      )}
    </div>
  );
}
