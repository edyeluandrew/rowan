/**
 * TopBar - Main navigation bar
 */
export const TopBar = ({ title, subtitle, actions }) => (
  <div className="bg-rowan-bg border-b border-rowan-border p-4">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-rowan-text">{title}</h1>
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  </div>
)

export default TopBar
