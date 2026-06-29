export default function MarketplaceSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-rowan-surface border border-rowan-border rounded-xl p-4 animate-pulse"
        >
          <div className="flex justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-rowan-border rounded w-2/5" />
              <div className="h-3 bg-rowan-border rounded w-1/4" />
            </div>
            <div className="h-8 w-8 bg-rowan-border rounded-full" />
          </div>
          <div className="h-3 bg-rowan-border rounded w-3/5 mt-4" />
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="h-10 bg-rowan-border rounded-lg" />
            <div className="h-10 bg-rowan-border rounded-lg" />
          </div>
          <div className="h-11 bg-rowan-border rounded-xl mt-4" />
        </div>
      ))}
    </div>
  )
}
