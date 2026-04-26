/**
 * MicroInteractions - 微交互反馈组件
 *
 * 提供按钮点击反馈、悬停效果、状态变化等微动效
 * 设计原则：克制、有意义、不干扰写作
 *
 * 设计规范：
 * - Hover: 微妙颜色变化，不位移
 * - Active/Press: scale(0.98), 100ms
 * - Error: 红色抖动 (shake)
 * - 支持 prefers-reduced-motion
 */

import * as React from 'react'
import { motion, type HTMLMotionProps, AnimatePresence, type Variants } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

// ==================== Reusable Framer Motion Variants ====================

/** 标准缓动曲线：cubic-bezier(0.22, 1, 0.36, 1) */
export const easeOutSmooth = [0.22, 1, 0.36, 1] as const

/** 弹性缓动曲线 */
export const easeSpring = [0.34, 1.56, 0.64, 1] as const

/** 微交互变体集合 */
export const microVariants: Record<string, Variants> = {
  /** 按钮按压反馈 */
  buttonPress: {
    initial: { scale: 1 },
    hover: { scale: 1.02 },
    tap: { scale: 0.97 },
  },
  /** 列表项依次进入 */
  listItem: {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
        ease: easeOutSmooth,
      },
    }),
  },
  /** 卡片悬停发光扩展 */
  cardGlow: {
    initial: { boxShadow: '0 0 0 rgba(94, 106, 210, 0)' },
    hover: {
      boxShadow: '0 0 20px rgba(94, 106, 210, 0.15), 0 0 40px rgba(94, 106, 210, 0.08), 0 8px 24px rgba(0, 0, 0, 0.12)',
      y: -2,
      transition: { duration: 0.25, ease: easeOutSmooth },
    },
  },
  /** 输入框聚焦发光扩展 */
  inputGlow: {
    initial: { boxShadow: '0 0 0 0 rgba(94, 106, 210, 0)' },
    focus: {
      boxShadow: '0 0 0 3px rgba(94, 106, 210, 0.15), 0 0 12px rgba(94, 106, 210, 0.1)',
      transition: { duration: 0.2, ease: easeOutSmooth },
    },
  },
  /** 淡入上滑 */
  fadeUp: {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: easeOutSmooth },
    },
  },
  /** 缩放淡入 */
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.25, ease: easeOutSmooth },
    },
  },
  /** 抖动（错误反馈） */
  shake: {
    initial: { x: 0 },
    shake: {
      x: [0, -6, 6, -4, 4, -2, 2, 0],
      transition: { duration: 0.4, ease: 'easeInOut' },
    },
  },
}

/** 检测是否应减少动画（prefers-reduced-motion 或低性能设备） */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}

// ==================== Button Feedback ====================

interface RippleEffectProps extends HTMLMotionProps<'span'> {
  color?: string
}

/**
 * RippleEffect - 波纹点击效果
 * 仅在点击时触发，不常驻
 */
export function RippleEffect({ color = 'rgba(255, 255, 255, 0.2)', ...props }: RippleEffectProps) {
  return (
    <motion.span
      {...props}
      className={cn('absolute inset-0 pointer-events-none', props.className)}
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: 2.5, opacity: 0 }}
      transition={{ duration: 0.35, ease: easeOutSmooth }}
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
 * 包装按钮以提供点击反馈
 */
export function ButtonFeedback({
  children,
  className,
  ripple = false,
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
  const [isPressed, setIsPressed] = React.useState(false)
  const reducedMotion = useReducedMotion()

  return (
    <motion.button
      className={cn('relative overflow-hidden cursor-pointer', className)}
      whileHover={reducedMotion ? undefined : { opacity: 0.9 }}
      whileTap={scaleOnClick && !reducedMotion ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.1, ease: easeOutSmooth }}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      {...props}
    >
      {children}
      {ripple && isPressed && !reducedMotion && <RippleEffect color={rippleColor} />}
    </motion.button>
  )
}

// ==================== Button Press Feedback (Subtle Scale) ====================

interface PressFeedbackProps extends HTMLMotionProps<'button'> {
  children: ReactNode
  hoverScale?: number
  pressScale?: number
}

/**
 * PressFeedback - 按钮按压反馈
 * 悬停时轻微放大，按下时轻微缩小
 */
export function PressFeedback({
  children,
  className,
  hoverScale = 1.02,
  pressScale = 0.97,
  ...props
}: PressFeedbackProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.button
      className={cn('relative cursor-pointer', className)}
      whileHover={reducedMotion ? undefined : { scale: hoverScale }}
      whileTap={reducedMotion ? undefined : { scale: pressScale }}
      transition={{ duration: 0.1, ease: easeOutSmooth }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

// ==================== List Staggered Entrance ====================

interface StaggerListProps {
  children: ReactNode[]
  className?: string
  itemClassName?: string
  staggerDelay?: number
  initialDelay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
}

/**
 * StaggerListEntrance - 列表项依次进入动画
 * 子元素依次以淡入+位移方式出现
 */
export function StaggerListEntrance({
  children,
  className,
  itemClassName,
  staggerDelay = 0.05,
  initialDelay = 0,
  direction = 'up',
}: StaggerListProps) {
  const reducedMotion = useReducedMotion()

  const directionOffset = {
    up: { y: 8 },
    down: { y: -8 },
    left: { x: 8 },
    right: { x: -8 },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, ...directionOffset[direction] },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        delay: initialDelay + i * staggerDelay,
        duration: 0.3,
        ease: easeOutSmooth,
      },
    }),
  }

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          custom={i}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className={itemClassName}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}

// ==================== Card Hover Glow Expansion ====================

interface CardHoverGlowProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  glowColor?: string
  glowIntensity?: number
}

/**
 * CardHoverGlow - 卡片悬停发光扩展
 * 悬停时卡片上浮并扩展发光效果
 */
export function CardHoverGlow({
  children,
  className,
  glowColor = 'rgba(94, 106, 210, 0.15)',
  glowIntensity = 1,
  ...props
}: CardHoverGlowProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      className={cn('relative', className)}
      initial={{ y: 0, boxShadow: '0 0 0 rgba(0,0,0,0)' }}
      whileHover={
        reducedMotion
          ? undefined
          : {
              y: -2,
              boxShadow: `0 0 ${20 * glowIntensity}px ${glowColor}, 0 0 ${40 * glowIntensity}px ${glowColor.replace('0.15', '0.08')}, 0 8px 24px rgba(0, 0, 0, 0.12)`,
            }
      }
      transition={{ duration: 0.25, ease: easeOutSmooth }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// ==================== Input Focus Glow Expansion ====================

interface InputFocusGlowProps extends React.InputHTMLAttributes<HTMLInputElement> {
  glowColor?: string
  containerClassName?: string
}

/**
 * InputFocusGlow - 输入框聚焦发光扩展
 * 聚焦时扩展发光效果
 */
export function InputFocusGlow({
  className,
  containerClassName,
  glowColor = 'rgba(94, 106, 210, 0.15)',
  onFocus,
  onBlur,
  ...props
}: InputFocusGlowProps) {
  const [isFocused, setIsFocused] = React.useState(false)
  const reducedMotion = useReducedMotion()

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    onBlur?.(e)
  }

  const glowStyle = isFocused && !reducedMotion
    ? {
        boxShadow: `0 0 0 3px ${glowColor}, 0 0 12px ${glowColor.replace('0.15', '0.1')}`,
        borderColor: 'var(--border-focus)',
      }
    : {}

  return (
    <motion.div
      className={cn('relative', containerClassName)}
      animate={glowStyle as any}
      transition={{ duration: 0.2, ease: easeOutSmooth }}
    >
      <input
        className={cn(
          'w-full rounded-lg border border-border-default bg-elevation-2 px-3 py-2',
          'text-sm text-text-primary placeholder:text-text-tertiary',
          'focus:outline-none focus:border-border-focus',
          'transition-colors duration-200',
          className
        )}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    </motion.div>
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
 * 悬停时仅改变颜色和背景，不上浮
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
      color: 'var(--paper-100)',
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
      whileHover={{ opacity: 0.85 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1, ease: easeOutSmooth }}
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
        className={cn('absolute bg-white rounded-full shadow-sm', thumb)}
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
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
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.12, ease: easeOutSmooth }}
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
 * 简化为静态颜色点，减少视觉干扰
 */
export function PulseIndicator({
  status = 'online',
  size = 'md',
  className,
}: PulseIndicatorProps) {
  const statusColors = {
    online: 'var(--color-success)',
    offline: 'var(--text-tertiary)',
    busy: 'var(--color-danger)',
    away: 'var(--color-warning)',
  }

  const sizeMap = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }

  return (
    <span
      className={cn('relative inline-flex rounded-full', sizeMap[size], className)}
      style={{ backgroundColor: statusColors[status] }}
    />
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
 * 默认关闭闪烁效果，仅在需要时启用
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
    default: 'rgba(255, 255, 255, 0.04)',
    accent: 'rgba(255, 255, 255, 0.1)',
    danger: 'rgba(255, 255, 255, 0.04)',
  }

  return (
    <motion.button
      className={cn('relative overflow-hidden rounded-lg px-4 py-2 font-medium', className)}
      style={{ backgroundColor: variantBg[variant] }}
      whileHover={{ opacity: 0.9 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1, ease: easeOutSmooth }}
      {...props}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent, ${shimmerColor ?? defaultShimmer[variant]}, transparent)`,
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
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
 * 简化为轻微跟随，不旋转
 */
export function MagneticEffect({ children, strength = 0.15, className }: MagneticEffectProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const reducedMotion = useReducedMotion()

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current || reducedMotion) return
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
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
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
  duration = 0.8,
  className,
  formatter = (v) => v.toString(),
}: CountUpNumberProps) {
  const [displayValue, setDisplayValue] = React.useState(0)
  const reducedMotion = useReducedMotion()

  React.useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value)
      return
    }

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
  }, [value, duration, reducedMotion])

  return <span className={className}>{formatter(displayValue)}</span>
}

// ==================== Shake Feedback ====================

interface ShakeFeedbackProps {
  children: ReactNode
  trigger: boolean
  className?: string
}

/**
 * ShakeFeedback - 抖动反馈（用于错误提示）
 * 触发时子元素左右抖动
 */
export function ShakeFeedback({ children, trigger, className }: ShakeFeedbackProps) {
  return (
    <motion.div
      className={className}
      animate={trigger ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
