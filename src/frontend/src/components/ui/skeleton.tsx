import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ============================================================
// SKELETON VARIANTS (cva)
// Animation: shimmer, pulse, none
// ============================================================

const skeletonVariants = cva('rounded-[var(--radius-md)]', {
  variants: {
    animation: {
      shimmer: 'animate-shimmer-skeleton',
      pulse: 'animate-pulse bg-[var(--color-surface-hover)]',
      none: 'bg-[var(--color-surface-hover)]',
    },
  },
  defaultVariants: {
    animation: 'shimmer',
  },
})

// ============================================================
// TYPES
// ============================================================

export type SkeletonVariants = VariantProps<typeof skeletonVariants>

// ============================================================
// SKELETON COMPONENT
// ============================================================

function Skeleton({
  className,
  animation,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & SkeletonVariants) {
  return (
    <div
      className={cn(skeletonVariants({ animation }), className)}
      {...props}
    />
  )
}

export { Skeleton, skeletonVariants }
