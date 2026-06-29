export default function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-rowan-surface border border-rowan-border rounded-xl p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-rowan-border shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-rowan-border rounded w-1/3" />
              <div className="h-4 bg-rowan-border rounded w-2/3" />
              <div className="h-3 bg-rowan-border rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
