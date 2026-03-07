import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Zap, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTrader } from '../hooks/useTrader';
import { useRequests } from '../hooks/useRequests';
import { useFloatHealth } from '../hooks/useFloatHealth';
import { useNotifications } from '../hooks/useNotifications';
import ConnectionDot from '../components/ui/ConnectionDot';
import StatCard from '../components/cards/StatCard';
import TrustScore from '../components/ui/TrustScore';
import FloatUpdateModal from '../components/modals/FloatUpdateModal';
import FloatHealthBanner from '../components/home/FloatHealthBanner';
import NotificationBadge from '../components/notifications/NotificationBadge';
import { formatCurrency } from '../utils/format';
import { CURRENCY_FLAGS } from '../utils/constants';

export default function Home() {
  const { trader } = useAuth();
  const { profile, stats, refresh } = useTrader();
  const { active } = useRequests();
  const { floatHealth } = useFloatHealth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [showFloat, setShowFloat] = useState(false);

  const name = profile?.name || trader?.name || 'Trader';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  /* Float balances from profile */
  const floatBalances = profile?.float_balances || {};
  const currencies = Object.entries(floatBalances).filter(([, v]) => v > 0);

  /* Active unconfirmed request */
  const activeRequest = active?.find((r) =>
    r.state === 'TRADER_MATCHED' || r.state === 'FIAT_SENT'
  );

  return (
    <div className="overflow-y-auto px-4 pt-4 pb-24 bg-rowan-bg min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-rowan-muted text-sm">{greeting}, {name}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/trader/notifications')}
            className="relative p-1 text-rowan-muted"
          >
            <Bell size={22} />
            {unreadCount > 0 && <NotificationBadge count={unreadCount} />}
          </button>
          <ConnectionDot />
        </div>
      </div>

      {/* Float Health Warning */}
      {floatHealth && <FloatHealthBanner health={floatHealth} />}

      {/* Active Request Banner */}
      {activeRequest && (
        <div
          className="bg-rowan-yellow text-rowan-bg font-bold rounded-md p-4 mb-4 flex justify-between items-center select-none"
          onClick={() => navigate(`/trader/requests/${activeRequest.id}`)}
        >
          <span className="flex items-center gap-1.5">
            <Zap size={16} /> Active Payout — complete now
          </span>
          <ChevronRight size={20} />
        </div>
      )}

      {/* Float Balance Card */}
      <div className="bg-rowan-surface border border-rowan-border rounded-md p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-rowan-muted text-xs uppercase tracking-wider">Available Float</span>
          <button
            className="text-rowan-yellow text-xs font-medium border border-rowan-yellow rounded px-3 py-1"
            onClick={() => setShowFloat(true)}
          >
            Update Float
          </button>
        </div>
        {currencies.length === 0 && (
          <p className="text-rowan-muted text-sm py-2">No float configured</p>
        )}
        {currencies.map(([cur, amount], i) => (
          <div
            key={cur}
            className={`flex justify-between items-center py-2 ${
              i < currencies.length - 1 ? 'border-b border-rowan-border' : ''
            }`}
          >
            <span className="text-rowan-text font-bold">
              {CURRENCY_FLAGS[cur] || ''} {cur}
            </span>
            <span className="text-rowan-yellow font-bold tabular-nums">
              {formatCurrency(amount, cur)}
            </span>
          </div>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard
          label="Completed Today"
          value={stats?.completed_today ?? 0}
          color="text-rowan-green"
        />
        <StatCard
          label="Volume Today"
          value={formatCurrency(stats?.volume_today_ugx ?? 0, 'UGX')}
          color="text-rowan-yellow"
        />
        <StatCard
          label="Earnings Today"
          value={formatCurrency(stats?.earnings_today ?? 0, 'UGX')}
          color="text-rowan-yellow"
        />
        <StatCard label="Trust Score">
          <TrustScore score={stats?.trust_score ?? profile?.trust_score ?? 0} />
        </StatCard>
      </div>

      {/* Float Update Modal */}
      {showFloat && (
        <FloatUpdateModal
          currentFloat={floatBalances}
          onClose={() => setShowFloat(false)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
