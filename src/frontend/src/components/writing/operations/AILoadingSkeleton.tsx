export function AILoadingSkeleton() {
  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl skeleton-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded-md skeleton-shimmer w-24" />
          <div className="h-2 rounded-md skeleton-shimmer w-16" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-20 rounded-xl skeleton-shimmer" />
        <div className="h-20 rounded-xl skeleton-shimmer" />
        <div className="h-20 rounded-xl skeleton-shimmer" />
        <div className="h-20 rounded-xl skeleton-shimmer" />
      </div>
      <div className="h-1.5 rounded-full skeleton-shimmer" />
      <div className="space-y-2">
        <div className="h-3 rounded-md skeleton-shimmer w-full" />
        <div className="h-3 rounded-md skeleton-shimmer w-3/4" />
      </div>
    </div>
  )
}