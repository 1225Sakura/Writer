import * as React from 'react'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'framer-motion'

// Hook to detect user's motion preference
function usePrefersReducedMotion() {
  const shouldReduceMotion = useReducedMotion()
  return shouldReduceMotion
}

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    hoverable?: boolean
    glowIntensity?: 'none' | 'subtle' | 'medium' | 'strong'
    pressed?: boolean
  }
>(({ className, hoverable = false, glowIntensity = 'none', pressed = false, ...props }, ref) => {
  const shouldReduceMotion = usePrefersReducedMotion()

  return (
    <motion.div
      ref={ref}
      initial={hoverable && !shouldReduceMotion ? { scale: 1, y: 0 } : false}
      whileHover={hoverable && !shouldReduceMotion ? { scale: 1.02, y: -4 } : undefined}
      whileTap={pressed && !shouldReduceMotion ? { scale: 0.98 } : undefined}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-xl border bg-card text-card-foreground',
        'shadow-[0_1px_2px_color-mix(in_srgb,var(--ink-100)_5%,transparent),0_2px_4px_color-mix(in_srgb,var(--ink-100)_8%,transparent),0_4px_8px_color-mix(in_srgb,var(--ink-100)_4%,transparent)]',
        'dark:shadow-[0_1px_2px_color-mix(in_srgb,var(--ink-100)_30%,transparent),0_2px_4px_color-mix(in_srgb,var(--ink-100)_20%,transparent),0_4px_8px_color-mix(in_srgb,var(--ink-100)_15%,transparent)]',
        'hover:shadow-[0_8px_16px_color-mix(in_srgb,var(--ink-100)_10%,transparent),0_16px_32px_color-mix(in_srgb,var(--ink-100)_8%,transparent),0_32px_64px_color-mix(in_srgb,var(--ink-100)_6%,transparent)]',
        'dark:hover:shadow-[0_8px_16px_color-mix(in_srgb,var(--ink-100)_40%,transparent),0_16px_32px_color-mix(in_srgb,var(--ink-100)_30%,transparent),0_32px_64px_color-mix(in_srgb,var(--ink-100)_20%,transparent)]',
        'transition-all duration-[var(--transition-base)] ease-out',
        glowIntensity === 'subtle' && 'shadow-[0_0_12px_color-mix(in_srgb,var(--color-location)_8%,transparent)] dark:shadow-[0_0_12px_color-mix(in_srgb,var(--color-location)_15%,transparent)]',
        glowIntensity === 'medium' && 'shadow-[0_0_16px_color-mix(in_srgb,var(--color-location)_12%,transparent)] dark:shadow-[0_0_16px_color-mix(in_srgb,var(--color-location)_20%,transparent)]',
        glowIntensity === 'strong' && 'shadow-[0_0_20px_color-mix(in_srgb,var(--color-location)_15%,transparent),0_0_40px_color-mix(in_srgb,var(--color-location)_8%,transparent)] dark:shadow-[0_0_20px_color-mix(in_srgb,var(--color-location)_25%,transparent),0_0_40px_color-mix(in_srgb,var(--color-location)_12%,transparent)]',
        className
      )}
      {...props as any}
    />
  )
})
Card.displayName = 'Card'

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
