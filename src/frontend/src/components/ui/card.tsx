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
        'rounded-xl border border-[var(--border-default)] bg-[var(--color-surface-raised)] text-[var(--text-primary)]',
        'shadow-[var(--shadow-card)]',
        'hover:shadow-[var(--shadow-drawer)]',
        'transition-all duration-[var(--transition-base)] ease-out',
        glowIntensity === 'subtle' && 'shadow-[var(--shadow-glow-sm)]',
        glowIntensity === 'medium' && 'shadow-[var(--shadow-glow)]',
        glowIntensity === 'strong' && 'shadow-[var(--shadow-glow-lg)]',
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
