/**
 * SlaMetricCard — reusable stat card for SLA tracker.
 * Props: label, value, subtitle, color (Tailwind text color class), icon (Lucide component)
 */
export default function SlaMetricCard({ label, value, subtitle, color = 'text-rowan-text', icon: Icon }) {
  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
      {Icon && <Icon size={20} className={color} />}
      <span className="text-rowan-muted text-xs uppercase tracking-wider block mt-1">{label}</span>
      <p className={`${color} text-4xl font-bold tabular-nums mt-1`}>{value}</p>
      {subtitle && <p className="text-rowan-muted text-xs mt-1">{subtitle}</p>}
    </div>
  );
}
