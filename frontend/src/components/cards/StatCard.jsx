export default function StatCard({ label, value, color = 'text-rowan-text', children }) {
  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-md p-4">
      <div className="text-rowan-muted text-xs uppercase tracking-wider mb-1">{label}</div>
      {children || (
        <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      )}
    </div>
  );
}
