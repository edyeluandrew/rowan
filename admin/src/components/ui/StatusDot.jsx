export default function StatusDot({ status = 'healthy', className = '' }) {
  const colors = {
    healthy: 'bg-rowan-green',
    degraded: 'bg-rowan-orange',
    down: 'bg-rowan-red',
  }

  const shouldPulse = status === 'degraded' || status === 'down'

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status] || colors.healthy} ${shouldPulse ? 'animate-pulse-dot' : ''} ${className}`}
    />
  )
}
