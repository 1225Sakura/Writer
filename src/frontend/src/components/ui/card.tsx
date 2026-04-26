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
      initial={hoverable && !shouldReduceMotion ? { scale: 1, y: 0 } : undefined}
      whileHover={hoverable && !shouldReduceMotion ? { scale: 1.02, y: -4 } : undefined}
      whileTap={pressed && !shouldReduceMotion ? { scale: 0.98 } : undefined}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-xl border bg-card text-card-foreground',
        'shadow-[0_1px_2px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.08),0_4px_8px_rgba(0,0,0,0.04)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.2),0_4px_8px_rgba(0,0,0,0.15)]',
        'hover:shadow-[0_8px_16px_rgba(0,0,0,0.1),0_16px_32px_rgba(0,0,0,0.08),0_32px_64px_rgba(0,0,0,0.06)]',
        'dark:hover:shadow-[0_8px_16px_rgba(0,0,0,0.4),0_16px_32px_rgba(0,0,0,0.3),0_32px_64px_rgba(0,0,0,0.2)]',
        'transition-all duration-[var(--transition-base)] ease-out',
        glowIntensity === 'subtle' && 'shadow-[0_0_12px_rgba(94,181,166,0.08)] dark:shadow-[0_0_12px_rgba(94,181,166,0.15)]',
        glowIntensity === 'medium' && 'shadow-[0_0_16px_rgba(94,181,166,0.12)] dark:shadow-[0_0_16px_rgba(94,181,166,0.2)]',
        glowIntensity === 'strong' && 'shadow-[0_0_20px_rgba(94,181,166,0.15),0_0_40px_rgba(94,181,166,0.08)] dark:shadow-[0_0_20px_rgba(94,181,166,0.25),0_0_40px_rgba(94,181,166,0.12)]',
        className
      )}
      {...props}
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
