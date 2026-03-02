/**
 * Small colored badge for status and labels.
 */
export default function Badge({ children, color = 'text-rowan-muted', bg = 'bg-rowan-surface', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${color} ${bg} ${className}`}
    >
      {children}
    </span>
  )
}
