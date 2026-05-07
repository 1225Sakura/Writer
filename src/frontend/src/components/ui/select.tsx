"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { DURATION, EASE, SPRING } from '@/components/shared/AnimationConfig'


export type SelectStatus = 'default' | 'focus' | 'error' | 'disabled'

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { status?: SelectStatus }
>(({ className, children, status = 'default', ...props }, ref) => {
  const [isFocused, setIsFocused] = React.useState(false)

  const statusColors = {
    default: {
      border: 'var(--border-default)',
      ring: 'transparent',
      labelColor: 'var(--text-secondary)',
    },
    focus: {
      border: 'var(--accent-100)',
      ring: 'rgba(201, 169, 110, 0.25)',
      labelColor: 'var(--accent-100)',
    },
    error: {
      border: 'var(--vermillion-100)',
      ring: 'rgba(196, 92, 92, 0.25)',
      labelColor: 'var(--vermillion-100)',
    },
    disabled: {
      border: 'var(--border-subtle)',
      ring: 'transparent',
      labelColor: 'var(--text-disabled)',
    },
  }

  const currentStatus = props.disabled ? 'disabled' : isFocused ? 'focus' : status
  const colors = statusColors[currentStatus]

  return (
    <div className="relative">
      <SelectPrimitive.Trigger
        ref={ref}
        className={cn(
          "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[var(--radius-input)] border bg-[var(--color-surface-input)] px-4 py-2 text-sm shadow-sm",
          "text-[var(--text-primary)]",
          "ring-offset-background",
          "data-[placeholder]:text-[var(--text-secondary)]",
          "hover:border-[var(--border-strong)]/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[&>span]:line-clamp-1",
          "transition-all duration-200 ease-out",
          className
        )}
        style={{
          borderColor: colors.border,
          boxShadow: colors.ring !== 'transparent' ? `0 0 0 3px ${colors.ring}` : 'none',
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      >
        {children}
        <SelectPrimitive.Icon asChild>
          <motion.span
            animate={{ rotate: isFocused ? 180 : 0 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            className="flex items-center"
          >
            <ChevronDown className="h-4 w-4 opacity-60 text-[var(--text-tertiary)]" />
          </motion.span>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      {/* Focus inner glow */}
      <AnimatePresence>
        {isFocused && !props.disabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            className="absolute inset-0 rounded-[var(--radius-input)] pointer-events-none"
            style={{
              boxShadow: `inset 0 0 20px rgba(201, 169, 110, 0.12)`,
              border: `1px solid var(--accent-100)`,
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
})
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--color-surface-raised)] text-[var(--text-primary)] shadow-[var(--shadow-drawer)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-90 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "origin-[--radix-select-content-transform-origin]",
        "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-[var(--radius-button)] py-2 px-3 text-sm outline-none",
      "text-[var(--text-primary)]",
      "transition-all duration-150",
      "focus:bg-[var(--color-surface-hover)] focus:text-[var(--text-primary)]",
      "hover:bg-[var(--color-surface-hover)]/80 hover:text-[var(--text-primary)]",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={SPRING.SNAPPY}
        >
          <Check className="h-4 w-4 text-[var(--accent-100)]" />
        </motion.span>
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1.5 h-px bg-[var(--border-default)]", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}