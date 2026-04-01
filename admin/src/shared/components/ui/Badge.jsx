/**
 * Badge component - small colored tags
 */
export default function Badge({ variant = 'info', color, bg, children }) {
  const colors = {
    error: 'bg-rowan-red/10 text-rowan-red',
    success: 'bg-rowan-green/10 text-rowan-green',
    info: 'bg-rowan-blue/10 text-rowan-blue',
    warning: 'bg-rowan-orange/10 text-rowan-orange'
  }

  // Support custom color/bg props or variant
  const badgeColor = color || colors[variant].split(' ')[1]
  const badgeBg = bg || colors[variant].split(' ')[0]

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeBg} ${badgeColor}`}>
      {children}
    </span>
  )
}
