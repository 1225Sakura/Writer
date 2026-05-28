"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden rounded-lg", className)}
    style={{ scrollbarGutter: "stable" }}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-all duration-200 ease-out",
      "hover:[&>span]:opacity-100",
      orientation === "vertical" &&
        "h-full w-2.5 px-0.5",
      orientation === "horizontal" &&
        "h-2.5 w-full flex-col py-0.5",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb
      className={cn(
        "relative flex-1 rounded-full",
        "bg-[var(--ink-70)]",
        "hover:bg-[var(--accent-80)]",
        "active:bg-[var(--accent-100)]",
        "transition-colors duration-150",
        "shadow-[inset_0_1px_1px_color-mix(in srgb, var(--accent-100) 6%, transparent)]",
        "before:absolute before:inset-0 before:rounded-full",
        "before:bg-gradient-to-b before:from-[var(--paper-100)]/5 before:to-transparent",
        "hover:shadow-[inset_0_1px_2px_color-mix(in srgb, var(--accent-100) 10%, transparent)]"
      )}
      style={{
        minWidth: orientation === "vertical" ? "6px" : undefined,
        minHeight: orientation === "horizontal" ? "6px" : undefined,
      }}
    />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
