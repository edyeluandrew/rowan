import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, TrendingUp, Coins, ArrowLeftRight, Trophy } from 'lucide-react';
import { useEarnings } from '../hooks/useEarnings';
import { formatCurrency } from '../utils/format';
import EarningsPeriodSelector from '../components/earnings/EarningsPeriodSelector';
import EarningsChart from '../components/earnings/EarningsChart';
import NetworkBreakdownCard from '../components/earnings/NetworkBreakdownCard';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function Earnings() {
  const navigate = useNavigate();
  const { period, earnings, transactions, isLoading, changePeriod, fetch } = useEarnings('30d');

  useEffect(() => { fetch('30d'); }, [fetch]);

  const e = earnings || {};
  const byDay = e.byDay || [];
  const byNetwork = e.byNetwork || [];

  /* Best day calculation */
  const bestDay = byDay.length
    ? byDay.reduce((best, d) => ((d.usdc || 0) > (best.usdc || 0) ? d : best), byDay[0])
    : null;

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <TrendingUp size={20} className="text-rowan-yellow" />
        <h1 className="text-rowan-text font-semibold text-lg">Earnings</h1>
      </div>

      <div className="px-4 pt-4">
        {/* Period selector */}
        <EarningsPeriodSelector selected={period} onChange={changePeriod} />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size={28} className="text-rowan-yellow" />
          </div>
        ) : (
          <>
            {/* Total Earnings card */}
            <div className="bg-rowan-surface border border-rowan-border rounded-xl p-5 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Coins size={18} className="text-rowan-yellow" />
                <span className="text-rowan-muted text-xs uppercase tracking-wider">Total USDC Earned</span>
              </div>
              <p className="text-rowan-yellow text-4xl font-bold tabular-nums">
                {(e.totalUsdc || 0).toFixed(2)}
              </p>
              <p className="text-rowan-muted text-sm tabular-nums mt-1">
                ≈ {formatCurrency(e.totalUgx || 0, 'UGX')}
              </p>

              <div className="flex mt-4 pt-3 border-t border-rowan-border">
                <div className="flex-1 text-center border-r border-rowan-border">
                  <ArrowLeftRight size={14} className="text-rowan-muted mx-auto mb-1" />
                  <p className="text-rowan-text font-bold">{e.transactionCount || 0}</p>
                  <p className="text-rowan-muted text-xs">Transactions</p>
                </div>
                <div className="flex-1 text-center border-r border-rowan-border">
                  <Coins size={14} className="text-rowan-muted mx-auto mb-1" />
                  <p className="text-rowan-text font-bold tabular-nums">
                    {(e.averagePerTx || 0).toFixed(2)}
                  </p>
                  <p className="text-rowan-muted text-xs">Avg Per Tx</p>
                </div>
                <div className="flex-1 text-center">
                  <Trophy size={14} className="text-rowan-muted mx-auto mb-1" />
                  <p className="text-rowan-text font-bold tabular-nums">
                    {bestDay ? (bestDay.usdc || 0).toFixed(2) : '—'}
                  </p>
                  <p className="text-rowan-muted text-xs">Best Day</p>
                </div>
              </div>
            </div>

            {/* Chart */}
            {byDay.length > 0 && (
              <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mt-3">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-rowan-muted" />
                  <h3 className="text-rowan-text font-bold text-sm">Daily Earnings</h3>
                </div>
                <EarningsChart data={byDay} />
              </div>
            )}

            {/* Network breakdown */}
            {byNetwork.length > 0 && (
              <div className="mt-3">
                <NetworkBreakdownCard byNetwork={byNetwork} />
              </div>
            )}

            {/* Recent transactions */}
            {transactions.length > 0 && (
              <div className="mt-4">
                <h3 className="text-rowan-text font-bold text-sm mb-3">Recent Transactions</h3>
                {transactions.map((tx, i) => (
                  <div
                    key={tx.id || i}
                    className="flex justify-between items-center py-3 border-b border-rowan-border"
                  >
                    <div>
                      <p className="text-rowan-muted text-xs">
                        {new Date(tx.created_at || tx.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-rowan-muted text-xs font-mono">{tx.reference || tx.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-rowan-yellow font-bold tabular-nums text-sm">
                        {(tx.usdc_earned || tx.usdc || 0).toFixed(2)} USDC
                      </p>
                      <Badge type="network" value={tx.network} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
