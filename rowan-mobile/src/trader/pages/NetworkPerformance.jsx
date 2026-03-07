import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, BarChart3, PieChart, CircleCheckBig, Timer, Coins,
} from 'lucide-react';
import { getNetworkPerformance } from '../api/sla';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatCurrency } from '../utils/format';

function formatTime(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function rateBorderColor(pct) {
  if (pct >= 95) return 'border-l-4 border-l-rowan-green';
  if (pct >= 85) return 'border-l-4 border-l-rowan-yellow';
  return 'border-l-4 border-l-rowan-red';
}

function rateColor(pct) {
  if (pct >= 95) return 'text-rowan-green';
  if (pct >= 85) return 'text-rowan-yellow';
  return 'text-rowan-red';
}

export default function NetworkPerformance() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getNetworkPerformance();
        setData(res);
      } catch { setError('Failed to load network data'); } finally {
        setLoading(false);
      }
    })();
  }, []);

  const networks = data?.byNetwork || [];

  /* Overall completion rate */
  const totalTx = networks.reduce((s, n) => s + (n.totalTransactions || 0), 0);
  const totalCompleted = networks.reduce(
    (s, n) => s + Math.round((n.completionRate || 0) / 100 * (n.totalTransactions || 0)),
    0,
  );
  const overallRate = totalTx > 0 ? (totalCompleted / totalTx * 100) : 0;

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={28} className="text-rowan-yellow" />
      </div>
    );
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <BarChart3 size={20} className="text-rowan-yellow" />
        <h1 className="text-rowan-text font-semibold text-lg">Network Performance</h1>
      </div>

      <div className="px-4">
        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 my-4 text-rowan-red text-sm">{error}</div>
        )}
        {networks.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <BarChart3 size={48} className="text-rowan-muted mb-4" />
            <p className="text-rowan-muted text-sm text-center">
              No performance data yet. Complete your first transaction to see network stats.
            </p>
          </div>
        ) : (
          <>
            {/* Overall summary */}
            <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mt-4">
              <div className="flex items-center gap-2">
                <PieChart size={16} className="text-rowan-muted" />
                <span className="text-rowan-muted text-xs">Overall Completion Rate</span>
              </div>
              <p className={`text-4xl font-bold tabular-nums ${rateColor(overallRate)}`}>
                {overallRate.toFixed(0)}%
              </p>
              <p className="text-rowan-muted text-xs mt-1">Across all networks</p>
            </div>

            {/* Network cards */}
            {networks.map((net, i) => {
              const cr = net.completionRate || 0;
              return (
                <div
                  key={i}
                  className={`bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-3 mt-3 ${rateBorderColor(cr)}`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <Badge type="network" value={net.network} />
                    <span className="text-rowan-muted text-xs">{net.totalTransactions || 0} transactions</span>
                  </div>

                  {/* Completion rate bar */}
                  <div className="flex items-center justify-between mt-3 mb-1">
                    <span className="text-rowan-muted text-xs">Completion</span>
                    <span className={`text-sm font-bold tabular-nums ${rateColor(cr)}`}>
                      {cr.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-rowan-border">
                    <div
                      className="h-full rounded-full bg-rowan-green transition-all"
                      style={{ width: `${Math.min(cr, 100)}%` }}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="flex justify-between mt-3 text-center">
                    <div>
                      <CircleCheckBig size={14} className="text-rowan-green mx-auto mb-1" />
                      <p className="text-rowan-green font-bold tabular-nums">
                        {Math.round(cr / 100 * (net.totalTransactions || 0))}
                      </p>
                      <p className="text-rowan-muted text-xs">Completed</p>
                    </div>
                    <div>
                      <Timer size={14} className="text-rowan-muted mx-auto mb-1" />
                      <p className="text-rowan-text font-bold tabular-nums">
                        {formatTime(net.avgTime || net.avg_time)}
                      </p>
                      <p className="text-rowan-muted text-xs">Avg Time</p>
                    </div>
                    <div>
                      <Coins size={14} className="text-rowan-yellow mx-auto mb-1" />
                      <p className="text-rowan-yellow font-bold tabular-nums">
                        {formatCurrency(net.totalVolume || net.total_volume || 0, 'UGX')}
                      </p>
                      <p className="text-rowan-muted text-xs">Volume</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
