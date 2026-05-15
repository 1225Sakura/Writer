/**
 * GridContainer - Bento grid layout container
 *
 * Features:
 * - Configurable column count
 * - Auto-responsive (single column on mobile)
 * - Custom gap and max width support
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GridContainerProps {
  children: ReactNode
  className?: string
  columns?: number
  gap?: string
  maxWidth?: string
}

export function BentoGrid({
  children,
  className,
  columns = 3,
  gap = '12px',
  maxWidth = '1200px',
}: GridContainerProps) {
  return (
    <div
      className={cn(
        'grid w-full',
        'grid-cols-1',
        columns >= 2 && 'sm:grid-cols-2',
        columns >= 3 && 'lg:grid-cols-3',
        columns >= 4 && 'xl:grid-cols-4',
        className
      )}
      style={{
        gap,
        maxWidth,
        margin: '0 auto',
      }}
    >
      {children}
    </div>
  )
}
