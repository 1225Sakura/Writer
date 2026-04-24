import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"

export interface HoverCardProps {
  children: React.ReactNode
  content: React.ReactNode
  openDelay?: number
  closeDelay?: number
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  className?: string
  contentClassName?: string
}

export function HoverCard({
  children,
  content,
  openDelay = 200,
  closeDelay = 150,
  side = "top",
  align = "center",
  sideOffset = 8,
  className,
  contentClassName,
}: HoverCardProps) {
  const [open, setOpen] = React.useState(false)
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout>>()

  const handleMouseEnter = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
    openTimerRef.current = setTimeout(() => {
      setOpen(true)
    }, openDelay)
  }, [openDelay])

  const handleMouseLeave = React.useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = undefined
    }
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
    }, closeDelay)
  }, [closeDelay])

  React.useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <div
        className={cn("inline-block", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <PopoverPrimitive.Trigger asChild>
          <div className="cursor-pointer">{children}</div>
        </PopoverPrimitive.Trigger>
      </div>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "z-50 rounded-xl border border-white/10 bg-gradient-to-b from-[#1e1e24] to-[#16161a] px-4 py-3.5 text-sm text-[#e8e8ec] shadow-xl shadow-black/40",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            "data-[state=closed]:slide-out-to-bottom-2 data-[state=closed]:slide-out-to-left-2 data-[state=closed]:slide-out-to-right-2 data-[state=closed]:slide-out-to-top-2",
            "origin-[--radix-popover-content-transform-origin]",
            "transition-all duration-200 ease-out",
            contentClassName
          )}
        >
          {content}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
