/**
 * SkeletonChartVariants - Chart-specific skeleton variants
 *
 * Provides ChartBarSkeleton and ChartLineSkeleton for chart loading states.
 */

import { cn } from '@/lib/utils'
import { ShimmerBlock, type ShimmerTone } from './SkeletonPrimitives'

/** Chart bar skeleton -- bar chart shape with shimmer */
export function ChartBarSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
  const bars = [65, 40, 85, 55, 70, 45, 90, 60, 75, 50]
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] p-4 border space-y-4',
        className
      )}
      style={{
        backgroundColor: 'var(--color-surface-raised)',
        borderColor: 'var(--border-default)',
      }}
    >
      <ShimmerBlock height={16} width="35%" tone={tone} />
      <div className="flex items-end gap-2 h-36 px-2">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="w-full relative overflow-hidden rounded-t-md"
              style={{ height: `${h}%` }}
            >
              <ShimmerBlock
                height="100%"
                width="100%"
                tone={tone}
                className="rounded-t-md"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between px-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerBlock key={i} height={10} width={24} tone={tone} className="rounded-sm" />
        ))}
      </div>
    </div>
  )
}

/** Chart line skeleton -- line chart shape with shimmer */
export function ChartLineSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] p-4 border space-y-4',
        className
      )}
      style={{
        backgroundColor: 'var(--color-surface-raised)',
        borderColor: 'var(--border-default)',
      }}
    >
      <ShimmerBlock height={16} width="40%" tone={tone} />
      <div className="relative h-36 px-2">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-px w-full" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.3 }} />
          ))}
        </div>
        {/* Line path placeholder */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`lineGrad-${tone}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,100 Q50,60 100,80 T200,40 T300,70 T400,30 T500,60 T600,20 T700,50 T800,35 T900,45 T1000,25"
            fill={`url(#lineGrad-${tone})`}
            stroke="var(--accent-primary)"
            strokeWidth="2"
            strokeOpacity="0.2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Data point placeholders */}
        <div className="absolute inset-0 flex items-end justify-between px-1">
          {[80, 45, 65, 30, 55, 20, 50, 35, 60, 25].map((h, i) => (
            <div key={i} className="flex flex-col items-center" style={{ height: `${h}%` }}>
              <ShimmerBlock width={8} height={8} tone={tone} className="rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between px-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerBlock key={i} height={10} width={28} tone={tone} className="rounded-sm" />
        ))}
      </div>
    </div>
  )
}
