import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "relative inline-flex h-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--ink-80)]/60 p-1 text-muted-foreground backdrop-blur-sm",
      "border border-[var(--color-border)]/50 shadow-inner",
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
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1",
      "disabled:pointer-events-none disabled:opacity-40",
      "data-[state=active]:text-foreground",
      "hover:text-[var(--text-secondary)]",
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
          "relative inline-flex h-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--ink-80)]/60 p-1",
          "border border-[var(--color-border)]/50 shadow-inner overflow-hidden",
          indicatorClassName
        )}
      >
        {/* Sliding indicator */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-lg bg-[var(--color-bg-surface)] shadow-sm border border-[var(--color-border)]/30"
          initial={false}
          animate={indicatorStyle as any}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 35,
          }}
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
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
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
