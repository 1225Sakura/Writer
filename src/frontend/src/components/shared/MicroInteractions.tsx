/**
 * MicroInteractions - 微交互反馈组件
 *
 * 提供按钮点击反馈、悬停效果、状态变化等微动效
 *
 * 设计规范（DESIGN_VISUAL.md）：
 * - Hover: scale(1.02), 150ms
 * - Active/Press: scale(0.98), 100ms
 * - Error: 红色抖动 (shake)
 */

import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

// ==================== Button Feedback ====================

interface RippleEffectProps extends HTMLMotionProps<'span'> {
  color?: string
}

/**
 * RippleEffect - 波纹点击效果
 */
export function RippleEffect({ color = 'rgba(255, 255, 255, 0.3)', ...props }: RippleEffectProps) {
  return (
    <motion.span
      {...props}
      className={cn('absolute inset-0 pointer-events-none', props.className)}
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: 2.5, opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{
        backgroundColor: color,
        borderRadius: '50%',
        width: '100%',
        height: '100%',
      }}
    />
  )
}

/**
 * ButtonFeedback - 按钮反馈组件
 * 包装按钮以提供波纹效果和点击反馈
 */
export function ButtonFeedback({
  children,
  className,
  ripple = true,
  rippleColor,
  scaleOnClick = true,
  ...props
}: {
  children: ReactNode
  className?: string
  ripple?: boolean
  rippleColor?: string
  scaleOnClick?: boolean
} & Omit<HTMLMotionProps<'button'>, 'children'>) {
  return (
    <motion.button
      className={cn('relative overflow-hidden cursor-pointer', className)}
      whileHover={{ scale: 1.02 }}
      whileTap={scaleOnClick ? { scale: 0.97 } : undefined}
      transition={{ duration: 0.1 }}
      {...props}
    >
      {children}
      {ripple && <RippleEffect color={rippleColor} />}
    </motion.button>
  )
}

// ==================== Icon Button ====================

interface IconButtonProps extends HTMLMotionProps<'button'> {
  icon: ReactNode
  label?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'subtle' | 'accent'
  isActive?: boolean
}

/**
 * IconButton - 图标按钮
 */
export function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  isActive = false,
  className,
  ...props
}: IconButtonProps) {
  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  }

  const variantStyles: Record<string, CSSProperties> = {
    ghost: {
      background: 'transparent',
      border: '1px solid transparent',
      color: 'var(--text-secondary)',
    },
    subtle: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid var(--border-default)',
      color: 'var(--text-primary)',
    },
    accent: {
      background: 'var(--accent-primary)',
      border: '1px solid transparent',
      color: '#fff',
    },
  }

  const activeStyle: CSSProperties = isActive
    ? {
        background: 'var(--accent-muted)',
        borderColor: 'var(--accent-primary)',
        color: 'var(--accent-primary)',
      }
    : {}

  return (
    <motion.button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium',
        sizeMap[size],
        className
      )}
      style={{
        ...variantStyles[variant],
        ...activeStyle,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15 }}
      aria-label={label}
      {...props}
    >
      {icon}
    </motion.button>
  )
}

// ==================== Toggle Switch ====================

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

/**
 * Toggle - 切换开关
 */
export function Toggle({
  checked,
  onChange,
  size = 'md',
  disabled = false,
  className,
}: ToggleProps) {
  const sizeMap = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5' },
  }

  const { track, thumb } = sizeMap[size]

  return (
    <motion.button
      className={cn(
        'relative inline-flex items-center rounded-full cursor-pointer transition-colors',
        track,
        checked ? 'bg-accent-primary' : 'bg-elevation-4',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      style={{
        backgroundColor: checked ? 'var(--accent-primary)' : 'var(--elevation-4)',
      }}
      onClick={() => !disabled && onChange(!checked)}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
    >
      <motion.div
        className={cn('absolute bg-white rounded-full shadow-md', thumb)}
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </motion.button>
  )
}

// ==================== HoverCard ====================

interface HoverCardProps {
  children: ReactNode
  content?: ReactNode
  className?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}

/**
 * HoverCard - 悬停显示卡片
 */
export function HoverCard({
  children,
  content,
  className,
  side = 'top',
  align = 'center',
}: HoverCardProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <AnimatePresence>
        {isHovered && content && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 p-3 rounded-lg border shadow-lg',
              'bg-elevation-3 border-border-default',
              side === 'top' && 'bottom-full mb-2',
              side === 'bottom' && 'top-full mt-2',
              side === 'left' && 'right-full mr-2',
              side === 'right' && 'left-full ml-2',
              align === 'start' && (side === 'top' || side === 'bottom') && 'left-0',
              align === 'end' && (side === 'top' || side === 'bottom') && 'right-0',
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==================== PulseIndicator ====================

interface PulseIndicatorProps {
  status?: 'online' | 'offline' | 'busy' | 'away'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * PulseIndicator - 脉冲状态指示器
 */
export function PulseIndicator({
  status = 'online',
  size = 'md',
  className,
}: PulseIndicatorProps) {
  const statusColors = {
    online: '#2ea043',
    offline: '#5c5f63',
    busy: '#d93a3a',
    away: '#e5a000',
  }

  const sizeMap = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  return (
    <motion.span
      className={cn('relative inline-flex rounded-full', sizeMap[size], className)}
      style={{ backgroundColor: statusColors[status] }}
      animate={status === 'online' ? { scale: [1, 1.2, 1] } : undefined}
      transition={{ duration: 2, repeat: Infinity }}
    >
      {(status === 'online' || status === 'busy') && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: statusColors[status] }}
          animate={{ scale: [1, 2], opacity: [0.5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.span>
  )
}

// ==================== ShimmerButton ====================

interface ShimmerButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode
  variant?: 'default' | 'accent' | 'danger'
  shimmerColor?: string
}

/**
 * ShimmerButton - 闪烁按钮
 */
export function ShimmerButton({
  children,
  variant = 'default',
  shimmerColor,
  className,
  ...props
}: ShimmerButtonProps) {
  const variantBg = {
    default: 'var(--elevation-2)',
    accent: 'var(--accent-primary)',
    danger: 'var(--color-danger)',
  }

  const defaultShimmer = {
    default: 'rgba(255, 255, 255, 0.1)',
    accent: 'rgba(255, 255, 255, 0.2)',
    danger: 'rgba(255, 255, 255, 0.1)',
  }

  return (
    <motion.button
      className={cn('relative overflow-hidden rounded-lg px-4 py-2 font-medium', className)}
      style={{ backgroundColor: variantBg[variant] }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      {...props}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent, ${shimmerColor ?? defaultShimmer[variant]}, transparent)`,
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
      <span className="relative z-10">{children}</span>
    </motion.button>
  )
}

// ==================== MagneticEffect ====================

interface MagneticEffectProps {
  children: ReactNode
  strength?: number
  className?: string
}

/**
 * MagneticEffect - 磁性悬停效果
 * 鼠标靠近时元素会被"吸"向鼠标方向
 */
export function MagneticEffect({ children, strength = 0.3, className }: MagneticEffectProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const deltaX = (e.clientX - centerX) * strength
    const deltaY = (e.clientY - centerY) * strength
    setPosition({ x: deltaX, y: deltaY })
  }

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 })
  }

  return (
    <motion.div
      ref={ref}
      className={cn('inline-flex', className)}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  )
}

// ==================== CountUpNumber ====================

interface CountUpNumberProps {
  value: number
  duration?: number
  className?: string
  formatter?: (value: number) => string
}

/**
 * CountUpNumber - 数字滚动动画
 */
export function CountUpNumber({
  value,
  duration = 1,
  className,
  formatter = (v) => v.toString(),
}: CountUpNumberProps) {
  const [displayValue, setDisplayValue] = React.useState(0)

  React.useEffect(() => {
    let startTime: number | null = null
    const startValue = displayValue

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease out cubic
      setDisplayValue(Math.round(startValue + (value - startValue) * eased))

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return <span className={className}>{formatter(displayValue)}</span>
}

// Import React for hooks
import * as React from 'react'
import { AnimatePresence } from 'framer-motion'