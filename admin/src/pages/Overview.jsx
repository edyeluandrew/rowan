import { useState, useCallback } from 'react'
import {
  ArrowLeftRight,
  Users,
  Flag,
  DollarSign,
  TrendingUp,
  Clock,
  Lock,
  AlertTriangle,
} from 'lucide-react'
import TopBar from '../components/layout/TopBar'
import StatCard from '../components/overview/StatCard'
import AlertBanner from '../components/overview/AlertBanner'
import RecentTransactions from '../components/overview/RecentTransactions'
import EscrowBalanceCard from '../components/escrow/EscrowBalanceCard'
import useOverview from '../hooks/useOverview'
import { formatXlm, formatCurrency, formatNumber } from '../utils/format'

export default function Overview() {
  const { data, loading, error, refetch } = useOverview()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const stats = data?.stats || {}
  const alerts = data?.alerts || []
  const recentTransactions = data?.recent_transactions || []
  const escrow = data?.escrow || {}

  return (
    <>
      <TopBar title="Overview" onRefresh={handleRefresh} refreshing={refreshing} alertCount={alerts.length} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {alerts.length > 0 && <AlertBanner alerts={alerts} />}

        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            Failed to load overview data. Retrying automatically.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Transactions Today" value={formatNumber(stats.transactions_today)} change={stats.transactions_change} icon={ArrowLeftRight} loading={loading} />
          <StatCard label="Active Traders" value={formatNumber(stats.active_traders)} change={stats.traders_change} icon={Users} loading={loading} />
          <StatCard label="Open Disputes" value={formatNumber(stats.open_disputes)} icon={Flag} loading={loading} />
          <StatCard label="Revenue Today" value={formatCurrency(stats.revenue_today)} change={stats.revenue_change} icon={DollarSign} loading={loading} />
          <StatCard label="Volume Today" value={formatXlm(stats.volume_today)} change={stats.volume_change} icon={TrendingUp} loading={loading} />
          <StatCard label="Avg Settlement" value={stats.avg_settlement_time ? `${stats.avg_settlement_time}m` : '-'} icon={Clock} loading={loading} />
          <StatCard label="Pending Approvals" value={formatNumber(stats.pending_approvals)} icon={Users} loading={loading} />
          <StatCard label="Escrow Locked" value={formatXlm(stats.escrow_locked)} icon={Lock} loading={loading} />
          <StatCard label="Failed Today" value={formatNumber(stats.failed_today)} icon={AlertTriangle} loading={loading} />
          <StatCard label="Success Rate" value={stats.success_rate ? `${stats.success_rate}%` : '-'} icon={TrendingUp} loading={loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <RecentTransactions transactions={recentTransactions} loading={loading} />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <EscrowBalanceCard status={escrow} loading={loading} />
          </div>
        </div>
      </div>
    </>
  )
}
