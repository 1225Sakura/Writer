import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse motion-reduce:animate-none rounded-[var(--radius-md)] bg-[var(--color-surface-overlay)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
