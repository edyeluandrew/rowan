export default function Badge({ children, color = 'text-rowan-muted', bg = 'bg-rowan-muted/20', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color} ${bg} ${className}`}>
      {children}
    </span>
  )
}
