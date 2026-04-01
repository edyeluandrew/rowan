import { useState, useCallback } from 'react'
import TopBar from '../../../shared/components/layout/TopBar'
import RevenueChart from '../components/RevenueChart'
import VolumeChart from '../components/VolumeChart'
import TraderLeaderboard from '../components/TraderLeaderboard'
import { useRevenue, useVolume, useTraderPerformance, useUserAnalytics } from '../hooks/useAnalytics'
import { formatNumber } from '../../../shared/utils/format'

const PERIODS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d')
  const revenue = useRevenue(period)
  const volume = useVolume(period, 'day')
  const traderPerf = useTraderPerformance()
  const userAnalytics = useUserAnalytics()

  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([revenue.refresh(), volume.refresh(), traderPerf.refresh(), userAnalytics.refresh()])
    setRefreshing(false)
  }, [revenue, volume, traderPerf, userAnalytics])

  return (
    <>
      <TopBar title="Analytics" onRefresh={handleRefresh} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex gap-1 bg-rowan-surface rounded-xl p-1 border border-rowan-border w-fit">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                period === p.value
                  ? 'bg-rowan-yellow/10 text-rowan-yellow font-medium'
                  : 'text-rowan-muted hover:text-rowan-text'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart data={revenue.data?.byDay || []} loading={revenue.loading} />
          <VolumeChart data={volume.data?.byDay || []} loading={volume.loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TraderLeaderboard traders={traderPerf.data || []} loading={traderPerf.loading} />

          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <h3 className="text-rowan-text font-bold mb-4">User Analytics</h3>
            {userAnalytics.loading ? (
              <div className="h-32 bg-rowan-border/30 rounded animate-pulse" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <StatBox label="Total Users" value={formatNumber(userAnalytics.data?.total_users)} />
                <StatBox label="New (7d)" value={formatNumber(userAnalytics.data?.new_users_7d)} />
                <StatBox label="New (30d)" value={formatNumber(userAnalytics.data?.new_users_30d)} />
                <StatBox label="Signups Trend" value={userAnalytics.data?.signups_by_day?.length ? `${userAnalytics.data.signups_by_day.length} days` : '-'} />
              </div>
            )}
          </div>
        </div>

        {volume.data?.byNetwork?.length > 0 && (
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <h3 className="text-rowan-text font-bold mb-4">Network Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {volume.data.byNetwork.map((item) => (
                <div key={item.network}>
                  <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">{item.network}</p>
                  <p className="text-rowan-text text-lg font-bold">{formatNumber(item.fiat_volume)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function StatBox({ label, value }) {
  return (
    <div>
      <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-rowan-text text-lg font-bold">{value || '-'}</p>
    </div>
  )
}
