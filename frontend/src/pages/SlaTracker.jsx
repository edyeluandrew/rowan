import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Timer, CheckCircle2, XCircle,
  Hourglass, Trophy, Lightbulb,
} from 'lucide-react';
import { getSlaPerformance } from '../api/sla';
import EarningsPeriodSelector from '../components/earnings/EarningsPeriodSelector';
import SlaMetricCard from '../components/sla/SlaMetricCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';

function formatTime(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeColor(seconds) {
  if (seconds == null) return 'text-rowan-text';
  if (seconds < 240) return 'text-rowan-green';
  if (seconds <= 300) return 'text-rowan-yellow';
  return 'text-rowan-red';
}

function rateColor(pct) {
  if (pct >= 90) return 'text-rowan-green';
  if (pct >= 75) return 'text-rowan-yellow';
  return 'text-rowan-red';
}

export default function SlaTracker() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30d');
  const [sla, setSla] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSla = async (p) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSlaPerformance(p);
      setSla(data);
    } catch { setError('Failed to load SLA data'); } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSla('30d'); }, []);

  const handlePeriod = (p) => {
    setPeriod(p);
    fetchSla(p);
  };

  const s = sla || {};
  const rate = s.slaMetRate ?? 0;
  const avgPayout = s.averagePayoutTime ?? 0;
  const avgResponse = s.averageResponseTime ?? 0;
  const breaches = s.slaBreaches ?? 0;
  const breakdown = s.breakdown || [];

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <Timer size={20} className="text-rowan-yellow" />
        <h1 className="text-rowan-text font-semibold text-lg">SLA Performance</h1>
      </div>

      <div className="px-4 pt-4">
        <EarningsPeriodSelector selected={period} onChange={handlePeriod} />

        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 my-4 text-rowan-red text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size={28} className="text-rowan-yellow" />
          </div>
        ) : (
          <>
            {/* Top metrics */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <SlaMetricCard
                label="SLA Met Rate"
                value={`${rate.toFixed(0)}%`}
                subtitle="Of transactions completed on time"
                color={rateColor(rate)}
                icon={CheckCircle2}
              />
              <SlaMetricCard
                label="Avg Payout Time"
                value={formatTime(avgPayout)}
                subtitle="vs 5:00 SLA"
                color={timeColor(avgPayout)}
                icon={Timer}
              />
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-rowan-surface border border-rowan-border rounded-xl p-3 text-center">
                <XCircle size={20} className="text-rowan-red mx-auto mb-1" />
                <p className="text-rowan-red font-bold text-xl tabular-nums">{breaches}</p>
                <p className="text-rowan-muted text-xs">SLA Breaches</p>
              </div>
              <div className="bg-rowan-surface border border-rowan-border rounded-xl p-3 text-center">
                <Hourglass size={20} className="text-rowan-muted mx-auto mb-1" />
                <p className="text-rowan-text font-bold tabular-nums">{formatTime(avgResponse)}</p>
                <p className="text-rowan-muted text-xs">Avg Response</p>
              </div>
              <div className="bg-rowan-surface border border-rowan-border rounded-xl p-3 text-center">
                <Trophy size={20} className="text-rowan-green mx-auto mb-1" />
                <p className="text-rowan-green font-bold tabular-nums">
                  {formatTime(s.bestTime ?? s.best_time)}
                </p>
                <p className="text-rowan-muted text-xs">Best Time</p>
              </div>
            </div>

            {/* Breakdown list */}
            {breakdown.length > 0 && (
              <div className="mt-4">
                <h3 className="text-rowan-text font-bold text-sm mb-3">Transaction Breakdown</h3>
                {breakdown.map((item, i) => {
                  const met = (item.payoutTime || item.payout_time || 0) <= 300;
                  return (
                    <div key={i} className="flex justify-between items-center py-3 border-b border-rowan-border">
                      <span className="text-rowan-muted text-xs font-mono">
                        {item.reference || item.transaction_id || item.id}
                      </span>
                      <span className={`font-mono tabular-nums text-sm ${timeColor(item.payoutTime || item.payout_time)}`}>
                        {formatTime(item.payoutTime || item.payout_time)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                        met
                          ? 'bg-rowan-green/15 text-rowan-green'
                          : 'bg-rowan-red/15 text-rowan-red'
                      }`}>
                        {met ? <><CheckCircle2 size={12} /> Met</> : <><XCircle size={12} /> Breached</>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tips */}
            <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={16} className="text-rowan-yellow" />
                <h3 className="text-rowan-text font-bold text-sm">How to improve your SLA</h3>
              </div>
              <ul className="text-rowan-muted text-xs leading-relaxed space-y-1.5">
                <li className="flex items-start gap-2"><ChevronRight size={13} className="text-rowan-muted flex-shrink-0 mt-0.5" /> Keep your phone notifications on at all times</li>
                <li className="flex items-start gap-2"><ChevronRight size={13} className="text-rowan-muted flex-shrink-0 mt-0.5" /> Have float ready before accepting requests</li>
                <li className="flex items-start gap-2"><ChevronRight size={13} className="text-rowan-muted flex-shrink-0 mt-0.5" /> Send mobile money immediately on acceptance</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
