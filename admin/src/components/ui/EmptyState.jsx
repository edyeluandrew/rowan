import Button from './Button'

export default function EmptyState({ icon: Icon, title, description, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {Icon && <Icon size={40} className="text-rowan-muted mb-4" />}
      <p className="text-rowan-text font-bold mb-1">{title}</p>
      {description && <p className="text-rowan-muted text-sm mb-4">{description}</p>}
      {action && onAction && (
        <Button variant="ghost" onClick={onAction}>{action}</Button>
      )}
    </div>
  )
}
