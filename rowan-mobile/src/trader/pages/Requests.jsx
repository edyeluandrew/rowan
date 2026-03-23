import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useRequests } from '../hooks/useRequests';
import { useSocket } from '../context/SocketContext';
import RequestCard from '../components/cards/RequestCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function Requests() {
  const [tab, setTab] = useState('incoming'); // 'incoming' | 'active'
  const { pending, active, loading, setPending, fetchActive } = useRequests();
  const { isConnected } = useSocket();

  const list = tab === 'incoming' ? pending : active;

  const handleRemove = (id) => {
    setPending((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="bg-rowan-bg min-h-screen px-4 pt-4 pb-24">
      {/* Tabs */}
      <div className="flex border-b border-rowan-border mb-4">
        <button
          className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${
            tab === 'incoming'
              ? 'text-rowan-yellow border-b-2 border-rowan-yellow'
              : 'text-rowan-muted'
          }`}
          onClick={() => setTab('incoming')}
        >
          Incoming
        </button>
        <button
          className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${
            tab === 'active'
              ? 'text-rowan-yellow border-b-2 border-rowan-yellow'
              : 'text-rowan-muted'
          }`}
          onClick={() => setTab('active')}
        >
          Active
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size={28} className="text-rowan-yellow" />
        </div>
      ) : list.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20">
          <LockKeyhole size={48} className="text-rowan-muted mb-4" />
          <span className="text-rowan-muted text-sm mb-3">
            {tab === 'incoming' ? 'Watching for requests...' : 'No active requests'}
          </span>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-rowan-green animate-pulse-dot' : 'bg-rowan-red'
              }`}
            />
            <span className={`text-xs ${isConnected ? 'text-rowan-green' : 'text-rowan-red'}`}>
              {isConnected ? 'Live' : 'Connection lost'}
            </span>
          </div>
        </div>
      ) : (
        /* Request list */
        <div>
          {list.map((req) => (
            <RequestCard key={req.id} request={req} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
