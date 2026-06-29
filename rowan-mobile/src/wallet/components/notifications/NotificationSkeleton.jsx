export default function NotificationSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-rowan-border animate-pulse">
          <div className="w-5 h-5 rounded-full bg-rowan-border mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-rowan-border rounded w-3/4" />
            <div className="h-2 bg-rowan-border rounded w-full" />
            <div className="h-2 bg-rowan-border rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
