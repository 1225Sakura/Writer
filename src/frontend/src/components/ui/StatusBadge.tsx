/**
 * StatusBadge - 带脉冲动画的状态徽章
 *
 * 支持多种状态类型（online, offline, busy, warning）
 * 脉冲点动画（使用keyframes），可选文字标签
 * 不同状态对应不同颜色
 */

import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'

export type StatusType = 'online' | 'offline' | 'busy' | 'warning' | 'error' | 'idle'

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 状态类型 */
  status: StatusType
  /** 显示文字标签 */
  label?: string
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 是否显示脉冲动画 */
  pulse?: boolean
  /** 是否显示脉冲环 */
  pulseRing?: boolean
  /** 是否显示为圆点（无文字背景） */
  dotOnly?: boolean
  /** 自定义标签文字（覆盖默认） */
  customLabel?: string
}

const statusConfig: Record<StatusType, { color: string; label: string; bgColor: string; textColor: string }> = {
  online: {
    color: 'var(--color-success)',
    label: '在线',
    bgColor: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
    textColor: 'var(--color-success)',
  },
  offline: {
    color: 'var(--text-tertiary)',
    label: '离线',
    bgColor: 'color-mix(in srgb, var(--text-tertiary) 12%, transparent)',
    textColor: 'var(--text-tertiary)',
  },
  busy: {
    color: 'var(--color-warning)',
    label: '忙碌',
    bgColor: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
    textColor: 'var(--color-warning)',
  },
  warning: {
    color: 'var(--color-warning)',
    label: '警告',
    bgColor: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
    textColor: 'var(--color-warning)',
  },
  error: {
    color: 'var(--color-danger)',
    label: '错误',
    bgColor: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
    textColor: 'var(--color-danger)',
  },
  idle: {
    color: 'var(--color-item)',
    label: '空闲',
    bgColor: 'color-mix(in srgb, var(--color-item) 12%, transparent)',
    textColor: 'var(--color-item)',
  },
}

const sizeMap = {
  sm: { dot: 6, ring: 10, fontSize: '11px', padding: '2px 8px', gap: '4px' },
  md: { dot: 8, ring: 14, fontSize: '12px', padding: '3px 10px', gap: '6px' },
  lg: { dot: 10, ring: 18, fontSize: '13px', padding: '4px 12px', gap: '8px' },
}

export const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  (
    {
      className,
      status,
      label,
      size = 'md',
      pulse = true,
      pulseRing = false,
      dotOnly = false,
      customLabel,
      ...props
    },
    ref
  ) => {
    const config = statusConfig[status]
    const sizeConfig = sizeMap[size]
    const displayLabel = customLabel ?? label ?? config.label

    if (dotOnly) {
      return (
        <div
          ref={ref}
          className={twMerge(clsx('relative inline-flex items-center justify-center', className))}
          {...props}
        >
          {/* Pulse ring */}
          {pulse && pulseRing && (
            <span
              className="absolute rounded-full animate-pulse-ring"
              style={{
                width: sizeConfig.ring,
                height: sizeConfig.ring,
                backgroundColor: config.color,
                opacity: 0.3,
              }}
            />
          )}
          {/* Dot */}
          <span
            className={clsx('relative rounded-full', pulse && 'animate-pulse')}
            style={{
              width: sizeConfig.dot,
              height: sizeConfig.dot,
              backgroundColor: config.color,
            }}
          />
        </div>
      )
    }

    return (
      <motion.div
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center rounded-full border',
            className
          )
        )}
        style={{
          padding: sizeConfig.padding,
          gap: sizeConfig.gap,
          backgroundColor: config.bgColor,
          borderColor: `${config.color}20`,
          fontSize: sizeConfig.fontSize,
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        {...(props as any)}
      >
        {/* Status dot with optional pulse */}
        <div className="relative flex items-center justify-center">
          {pulse && pulseRing && (
            <span
              className="absolute rounded-full animate-pulse-ring"
              style={{
                width: sizeConfig.ring,
                height: sizeConfig.ring,
                backgroundColor: config.color,
                opacity: 0.25,
              }}
            />
          )}
          <span
            className={clsx('relative rounded-full', pulse && status !== 'offline' && 'animate-pulse')}
            style={{
              width: sizeConfig.dot,
              height: sizeConfig.dot,
              backgroundColor: config.color,
            }}
          />
        </div>

        {/* Label */}
        {displayLabel && (
          <span
            className="font-medium whitespace-nowrap"
            style={{ color: config.textColor }}
          >
            {displayLabel}
          </span>
        )}
      </motion.div>
    )
  }
)

StatusBadge.displayName = 'StatusBadge'
