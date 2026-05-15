/** SpinnerVariants - Pure CSS spinner variant components for LoadingSpinner. */
import { cn } from '@/lib/utils'

interface SpinnerVariantProps {
  size: number
  color: string
  className?: string
}

/** Ring spinner — rotating circular border */
export function RingSpinner({ size, color, className }: SpinnerVariantProps) {
  const borderWidth = Math.max(2, size / 8)
  return (
    <div
      className={cn('animate-spin motion-reduce:animate-none', className)}
      style={{
        width: size,
        height: size,
        border: `${borderWidth}px solid ${color}20`,
        borderTopColor: color,
        borderRadius: '50%',
      }}
    />
  )
}

/** Pulse spinner — expanding and fading circle */
export function PulseSpinner({ size, color, className }: SpinnerVariantProps) {
  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full animate-pulse-ring motion-reduce:animate-none"
        style={{ backgroundColor: `${color}30` }}
      />
      <div
        className="absolute inset-0 rounded-full animate-pulse-ring motion-reduce:animate-none"
        style={{
          backgroundColor: `${color}20`,
          animationDelay: '0.5s',
        }}
      />
      <div
        className="absolute inset-0 m-auto rounded-full"
        style={{
          width: size * 0.4,
          height: size * 0.4,
          backgroundColor: color,
        }}
      />
    </div>
  )
}

/** Dots spinner — three bouncing dots */
export function DotsSpinner({ size, color, className }: SpinnerVariantProps) {
  const dotSize = Math.max(4, size / 4)
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'inline-block rounded-full',
            i === 0 && 'animate-dot-bounce',
            i === 1 && 'animate-dot-bounce-delay-1',
            i === 2 && 'animate-dot-bounce-delay-2'
          )}
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  )
}

/** Wave spinner — vertical bars with wave animation */
export function WaveSpinner({ size, color, className }: SpinnerVariantProps) {
  const barWidth = Math.max(3, size / 8)
  const barHeight = size
  return (
    <div className={cn('flex items-center gap-[3px]', className)} style={{ height: size }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: barWidth,
            height: barHeight * 0.6,
            backgroundColor: color,
            animation: `wave-bar 1.2s ease-in-out ${i * 0.1}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

/** Orbit spinner — dots orbiting a center point */
export function OrbitSpinner({ size, color, className }: SpinnerVariantProps) {
  const dotSize = Math.max(3, size / 10)
  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            animation: `orbit-spin ${1.5 + i * 0.2}s linear infinite`,
            animationDelay: `${i * 0.3}s`,
          }}
        >
          <span
            className="absolute rounded-full"
            style={{
              width: dotSize,
              height: dotSize,
              backgroundColor: color,
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              opacity: 1 - i * 0.2,
            }}
          />
        </div>
      ))}
    </div>
  )
}

/** Typing spinner — chat-style typing indicator */
export function TypingSpinner({ size, color, className }: SpinnerVariantProps) {
  const dotSize = Math.max(3, size / 5)
  return (
    <div className={cn('flex items-center gap-[3px]', className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block rounded-full animate-typing-dot-bounce"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}

/** Shimmer spinner — sweeping light effect */
export function ShimmerSpinner({ size, color, className }: SpinnerVariantProps) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-full', className)}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: `${color}15`,
          border: `2px solid ${color}30`,
        }}
      />
      <div
        className="absolute inset-0 rounded-full animate-shimmer motion-reduce:animate-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  )
}

/** Book spinner — writing-themed page flip */
export function BookSpinner({ size, color, className }: SpinnerVariantProps) {
  const pageWidth = size * 0.35
  const pageHeight = size * 0.8
  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {/* Book spine */}
      <div
        className="absolute rounded-full"
        style={{
          width: 2,
          height: pageHeight,
          backgroundColor: `${color}60`,
        }}
      />
      {/* Left page */}
      <div
        className="absolute"
        style={{
          width: pageWidth,
          height: pageHeight,
          right: '50%',
          backgroundColor: `${color}10`,
          border: `1px solid ${color}30`,
          borderRight: 'none',
          borderRadius: '2px 0 0 2px',
          animation: 'book-page-left 1.5s ease-in-out infinite',
        }}
      />
      {/* Right page */}
      <div
        className="absolute"
        style={{
          width: pageWidth,
          height: pageHeight,
          left: '50%',
          backgroundColor: `${color}10`,
          border: `1px solid ${color}30`,
          borderLeft: 'none',
          borderRadius: '0 2px 2px 0',
          animation: 'book-page-right 1.5s ease-in-out infinite',
        }}
      />
    </div>
  )
}

/** Multi-layer gradient rotating rings — enhanced visual */
export function RingsSpinner({ size, color, className }: SpinnerVariantProps) {
  const ringCount = 3
  const rings = Array.from({ length: ringCount }, (_, i) => {
    const ratio = (i + 1) / ringCount
    const ringSize = size * (0.4 + ratio * 0.6)
    const opacity = 0.5 - i * 0.12
    const duration = 2 + i * 0.8
    const direction = i % 2 === 0 ? 'normal' : 'reverse'
    const borderWidth = Math.max(1.5, size / 20)

    const gradientColors = [
      color,
      `${color}90`,
      `${color}50`,
      `${color}90`,
      color,
    ]

    return {
      size: ringSize,
      opacity,
      duration,
      direction,
      borderWidth,
      gradient: `conic-gradient(from 0deg, ${gradientColors.join(', ')})`,
      delay: i * 0.2,
    }
  })

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {rings.map((ring, i) => (
        <div
          key={i}
          className="absolute rounded-full motion-reduce:animate-none"
          style={{
            width: ring.size,
            height: ring.size,
            background: ring.gradient,
            opacity: ring.opacity,
            mask: `radial-gradient(circle, transparent ${ring.size / 2 - ring.borderWidth}px, black ${ring.size / 2 - ring.borderWidth + 0.5}px)`,
            WebkitMask: `radial-gradient(circle, transparent ${ring.size / 2 - ring.borderWidth}px, black ${ring.size / 2 - ring.borderWidth + 0.5}px)`,
            animation: `spin ${ring.duration}s linear infinite ${ring.direction}`,
            animationDelay: `${ring.delay}s`,
          }}
        />
      ))}
      {/* Center dot */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.12,
          height: size * 0.12,
          backgroundColor: color,
          opacity: 0.8,
          boxShadow: `0 0 ${size * 0.15}px ${color}60`,
        }}
      />
    </div>
  )
}
