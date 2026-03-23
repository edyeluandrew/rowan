import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { CHART_YELLOW, CHART_GREEN, CHART_MUTED, CHART_GRID } from '../../utils/constants'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl px-3 py-2 text-xs">
      <p className="text-rowan-muted mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="font-medium">
          {entry.name}: ${Number(entry.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function RevenueChart({ data = [], loading = false }) {
  if (loading) {
    return (
      <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
        <h3 className="text-rowan-text font-bold mb-4">Revenue</h3>
        <div className="h-64 bg-rowan-border/30 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
      <h3 className="text-rowan-text font-bold mb-4">Revenue</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
            <XAxis dataKey="date" stroke={CHART_MUTED} fontSize={11} tickLine={false} />
            <YAxis stroke={CHART_MUTED} fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stackId="1" stroke={CHART_YELLOW} fill={CHART_YELLOW} fillOpacity={0.2} name="Revenue" />
            <Area type="monotone" dataKey="volume" stackId="1" stroke={CHART_GREEN} fill={CHART_GREEN} fillOpacity={0.2} name="Volume" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
