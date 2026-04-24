import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-shimmer-skeleton rounded-[var(--radius-md)]',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
