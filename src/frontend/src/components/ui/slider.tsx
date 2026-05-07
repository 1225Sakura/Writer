import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center py-4",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-[var(--ink-80)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]">
      <SliderPrimitive.Range className="absolute h-full rounded-full transition-all duration-200 ease-out" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-6 w-6 rounded-full border-2 border-[var(--accent-100)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-elevated),var(--shadow-glow-sm)] transition-all duration-150 ease-out hover:scale-110 hover:shadow-[var(--shadow-elevated-lg),var(--shadow-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)] disabled:pointer-events-none disabled:opacity-50 active:scale-95 active:shadow-[var(--shadow-elevated),var(--shadow-glow-sm)]" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
