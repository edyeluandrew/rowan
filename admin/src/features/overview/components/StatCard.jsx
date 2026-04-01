import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function StatCard({ label, value, change, icon: Icon, loading = false }) {
  const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-rowan-green' : trend === 'down' ? 'text-rowan-red' : 'text-rowan-muted'

  return (
    <div className="bg-rowan-surface rounded-xl p-4 border border-rowan-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-rowan-muted text-xs uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={16} className="text-rowan-muted" />}
      </div>
      {loading ? (
        <div className="h-8 bg-rowan-border/30 rounded animate-pulse" />
      ) : (
        <>
          <p className="text-rowan-text text-2xl font-bold">{value}</p>
          {change !== undefined && change !== null && (
            <div className={`flex items-center gap-1 mt-1 ${trendColor}`}>
              <TrendIcon size={12} />
              <span className="text-xs font-medium">{Math.abs(change)}%</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
