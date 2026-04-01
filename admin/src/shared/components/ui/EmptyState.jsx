/**
 * Empty State component
 */
import { FileText } from 'lucide-react'

export const EmptyState = ({ title = 'No data', description = 'There is no data to display', icon, action = null }) => {
  const IconToUse = icon || FileText
  return (
    <div className="text-center py-12">
      <IconToUse className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-rowan-text">{title}</h3>
      <p className="mt-1 text-sm text-rowan-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export default EmptyState
