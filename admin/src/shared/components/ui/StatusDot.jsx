/**
 * StatusDot - colored status indicator
 */
export const StatusDot = ({ status = 'healthy', size = 'md' }) => {
  const colors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
    offline: 'bg-gray-500'
  }

  const sizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  return (
    <div className={`rounded-full ${colors[status] || colors.healthy} ${sizes[size] || sizes.md} inline-block`} />
  )
}

export default StatusDot
