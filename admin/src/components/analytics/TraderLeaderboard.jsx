import { useNavigate } from 'react-router-dom'
import { formatCurrency, formatPercent } from '../../utils/format'
import { Trophy, Medal } from 'lucide-react'

export default function TraderLeaderboard({ traders = [], loading = false }) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
        <h3 className="text-rowan-text font-bold mb-4">Top Traders</h3>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-rowan-border/30 rounded mb-2 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
      <h3 className="text-rowan-text font-bold mb-4">Top Traders</h3>
      {traders.length === 0 ? (
        <p className="text-rowan-muted text-sm text-center py-6">No trader data</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-rowan-muted text-xs uppercase tracking-wider">
              <th className="text-left pb-2 font-medium">#</th>
              <th className="text-left pb-2 font-medium">Trader</th>
              <th className="text-right pb-2 font-medium">Volume</th>
              <th className="text-right pb-2 font-medium">Success</th>
            </tr>
          </thead>
          <tbody>
            {traders.map((trader, i) => (
              <tr
                key={trader.id}
                onClick={() => navigate(`/traders/${trader.id}`)}
                className="border-t border-rowan-border/50 hover:bg-rowan-bg/50 cursor-pointer transition-colors"
              >
                <td className="py-2 text-sm">
                  {i === 0 ? (
                    <Trophy size={14} className="text-rowan-yellow" />
                  ) : i < 3 ? (
                    <Medal size={14} className="text-rowan-muted" />
                  ) : (
                    <span className="text-rowan-muted">{i + 1}</span>
                  )}
                </td>
                <td className="py-2 text-sm text-rowan-text">{trader.name || trader.id}</td>
                <td className="py-2 text-sm text-rowan-text text-right">{formatCurrency(trader.volume || 0)}</td>
                <td className="py-2 text-sm text-rowan-green text-right">{formatPercent(trader.success_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
