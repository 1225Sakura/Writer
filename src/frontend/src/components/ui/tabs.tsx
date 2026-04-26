import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

// Hook to detect user's motion preference
function usePrefersReducedMotion() {
  const shouldReduceMotion = useReducedMotion()
  return shouldReduceMotion ?? false
}

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "relative inline-flex h-10 items-center justify-center rounded-[var(--radius-lg)]",
      "bg-[var(--color-surface-base)]/80 backdrop-blur-sm",
      "border border-[var(--border-default)]/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
      "p-1 gap-1",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] px-4 py-1.5 text-sm font-medium",
      "transition-all duration-[var(--transition-fast)] ease-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50 focus-visible:ring-offset-1",
      "disabled:pointer-events-none disabled:opacity-40",
      "data-[state=active]:text-[var(--text-primary)] data-[state=active]:font-semibold",
      "data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
      "hover:text-[var(--text-secondary)]",
      "hover:bg-[var(--color-surface-hover)]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

// Animated tabs with sliding indicator
interface AnimatedTabsProps extends React.ComponentPropsWithoutRef<typeof Tabs> {
  indicatorClassName?: string
  triggerClassName?: string
  contentClassName?: string
}

const AnimatedTabs = React.forwardRef<
  React.ElementRef<typeof Tabs>,
  AnimatedTabsProps
>(({ className, indicatorClassName, triggerClassName, contentClassName, children, ...props }, ref) => {
  const [activeTab, setActiveTab] = React.useState<string | undefined>(undefined)
  const listRef = React.useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({})
  const shouldReduceMotion = usePrefersReducedMotion()

  React.useEffect(() => {
    if (!listRef.current) return
    const trigger = listRef.current.querySelector(`[data-state="active"]`) as HTMLElement
    if (trigger) {
      const parent = listRef.current.getBoundingClientRect()
      const child = trigger.getBoundingClientRect()
      setIndicatorStyle({
        left: child.left - parent.left,
        width: child.width,
      })
    }
  }, [activeTab])

  return (
    <Tabs
      ref={ref}
      className={className}
      onValueChange={(value) => setActiveTab(value)}
      {...props}
    >
      <TabsPrimitive.List
        ref={listRef}
        className={cn(
          "relative inline-flex h-10 items-center justify-center rounded-[var(--radius-lg)]",
          "bg-[var(--color-surface-base)]/80 backdrop-blur-sm",
          "border border-[var(--border-default)]/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
          "p-1 gap-1 overflow-hidden",
          indicatorClassName
        )}
      >
        {/* Sliding indicator */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-lg bg-[var(--color-surface-raised)] shadow-sm border border-[var(--border-default)]/30"
          initial={false}
          animate={indicatorStyle as any}
          transition={shouldReduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 400, damping: 35 }
          }
        />
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.type === TabsTrigger) {
            return React.cloneElement(child as React.ReactElement<{ className?: string }>, {
              className: cn(
                "relative z-10 text-sm font-medium transition-colors duration-[var(--transition-fast)]",
                (child.props as { className?: string }).className
              ),
            })
          }
          return child
        })}
      </TabsPrimitive.List>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === TabsContent) {
          return (
            <AnimatePresence mode="wait">
              <motion.div
                key={(child.props as { value?: string }).value}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={contentClassName}
              >
                {child}
              </motion.div>
            </AnimatePresence>
          )
        }
        return child
      })}
    </Tabs>
  )
})
AnimatedTabs.displayName = "AnimatedTabs"

export { Tabs, TabsList, TabsTrigger, TabsContent, AnimatedTabs }
