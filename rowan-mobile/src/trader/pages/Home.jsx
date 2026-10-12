import { useCallback, useEffect, useState } from 'react';
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
import { useTraderWallet } from '../context/TraderWalletContext';
import payoutSettingsAPI from '../api/payoutSettings';
import { NETWORKS } from '../utils/constants';

export default function Home() {
  const { trader } = useAuth();
  const { profile, stats, refresh } = useTrader();
  const { active } = useRequests();
  const { floatHealth } = useFloatHealth();
  const { unreadCount } = useNotifications();
  const { usdcBalance, publicKey } = useTraderWallet();
  const navigate = useNavigate();
  const [showFloat, setShowFloat] = useState(false);
  const [floatInitialId, setFloatInitialId] = useState(null);
  const [sellAds, setSellAds] = useState([]);

  const loadSellAds = useCallback(async () => {
    try {
      const response = await payoutSettingsAPI.fetchPayoutSettings();
      const rows = response?.data || [];
      setSellAds(rows.filter((ad) => (ad.ad_side || 'USER_SELL') === 'USER_SELL' && ad.is_active !== false));
    } catch {
      setSellAds([]);
    }
  }, []);

  useEffect(() => {
    loadSellAds();
  }, [loadSellAds]);

  const name = profile?.name || trader?.name || 'Trader';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const openFloat = (adId = null) => {
    setFloatInitialId(adId);
    setShowFloat(true);
  };

  /* Active unconfirmed request */
  const activeRequest = active?.find((r) =>
    ['TRADER_MATCHED', 'ESCROW_LOCKED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING'].includes(r.state)
  );

  return (
    <div className="overflow-y-auto px-4 pt-4 sm:px-6 lg:px-10 xl:px-14 bg-rowan-bg min-h-screen">
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

      {/* Rowan wallet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="w-full h-full text-left bg-rowan-surface border border-rowan-border rounded-md p-4">
          <div className="flex justify-between items-center">
            <span className="text-rowan-muted text-xs uppercase tracking-wider">USDC balance</span>
          </div>
          <p className="text-rowan-text text-2xl font-bold tabular-nums mt-1">
            {usdcBalance != null ? `${Number(usdcBalance).toFixed(2)} USDC` : '—'}
          </p>
          {publicKey && (
            <p className="text-rowan-muted text-[10px] font-mono mt-1 truncate">{publicKey}</p>
          )}
        </div>

        <div className="bg-rowan-surface border border-rowan-border rounded-md p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-rowan-muted text-xs uppercase tracking-wider">Available Float</span>
            <button
              className="text-rowan-yellow text-xs font-medium border border-rowan-yellow rounded px-3 py-1"
              onClick={() => openFloat(sellAds[0]?.id || null)}
            >
              Update Float
            </button>
          </div>
          {sellAds.length === 0 && (
            <p className="text-rowan-muted text-sm py-2">No cash-out float yet</p>
          )}
          {sellAds.map((ad, i) => {
            const net = Number(ad.available_float || 0) - Number(ad.reserved_float || 0);
            const label = NETWORKS[ad.network]?.label || ad.network;
            return (
              <div
                key={ad.id}
                className={`flex justify-between items-center py-2 ${
                  i < sellAds.length - 1 ? 'border-b border-rowan-border' : ''
                }`}
              >
                <span className="text-rowan-text font-bold">{label} {ad.currency}</span>
                <span className="text-rowan-yellow font-bold tabular-nums">
                  {formatCurrency(net, ad.currency)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <FloatHealthBanner
        floatHealth={floatHealth}
        onTopUp={(currency) => {
          const ad = sellAds.find((row) => row.currency === currency);
          openFloat(ad?.id || sellAds[0]?.id || null);
        }}
      />

      {activeRequest && (
        <div
          className="bg-rowan-yellow text-rowan-bg font-bold rounded-md p-4 mb-4 flex justify-between items-center gap-3 select-none"
          onClick={() => navigate(`/trader/requests/${activeRequest.id}`)}
        >
          <span className="flex items-center gap-1.5 min-w-0 text-sm sm:text-base">
            <Zap size={16} /> Active Payout — complete now
          </span>
          <ChevronRight size={20} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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
          ads={sellAds}
          initialId={floatInitialId}
          onClose={() => setShowFloat(false)}
          onSuccess={() => {
            refresh();
            loadSellAds();
          }}
        />
      )}
    </div>
  );
}
