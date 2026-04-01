import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { CHART_YELLOW, CHART_MUTED, CHART_GRID } from '../../../shared/utils/constants'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl px-3 py-2 text-xs">
      <p className="text-rowan-muted mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {Number(entry.value).toLocaleString()} XLM
        </p>
      ))}
    </div>
  )
}

export default function VolumeChart({ data = [], loading = false }) {
  if (loading) {
    return (
      <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
        <h3 className="text-rowan-text font-bold mb-4">Volume</h3>
        <div className="h-64 bg-rowan-border/30 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
      <h3 className="text-rowan-text font-bold mb-4">Volume</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="date" stroke={CHART_MUTED} style={{ fontSize: '12px' }} />
          <YAxis stroke={CHART_MUTED} style={{ fontSize: '12px' }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="volume" fill={CHART_YELLOW} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
