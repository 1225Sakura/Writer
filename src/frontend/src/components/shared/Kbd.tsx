/**
 * Kbd - 优雅的键盘快捷键显示组件
 *
 * 用于快捷键提示、命令面板、帮助文档
 * 主题自适应样式，支持多种尺寸和变体
 */

import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type KbdSize = 'xs' | 'sm' | 'md' | 'lg'
export type KbdVariant = 'default' | 'subtle' | 'accent' | 'danger' | 'ghost'

export interface KbdProps {
  children?: ReactNode
  className?: string
  /** 尺寸 */
  size?: KbdSize
  /** 变体风格 */
  variant?: KbdVariant
  /** 是否显示为组合键（如 Ctrl+K） */
  keys?: string[]
  /** 分隔符（组合键之间） */
  separator?: ReactNode
  /** 是否禁用样式（纯文本） */
  plain?: boolean
  /** 自定义样式 */
  style?: CSSProperties
}

const sizeMap: Record<KbdSize, CSSProperties> = {
  xs: {
    padding: '1px 4px',
    fontSize: '10px',
    lineHeight: '1.4',
    borderRadius: '3px',
    minWidth: '14px',
    height: '16px',
  },
  sm: {
    padding: '2px 6px',
    fontSize: '11px',
    lineHeight: '1.4',
    borderRadius: '4px',
    minWidth: '18px',
    height: '20px',
  },
  md: {
    padding: '3px 8px',
    fontSize: '12px',
    lineHeight: '1.4',
    borderRadius: '5px',
    minWidth: '22px',
    height: '24px',
  },
  lg: {
    padding: '4px 10px',
    fontSize: '13px',
    lineHeight: '1.4',
    borderRadius: '6px',
    minWidth: '26px',
    height: '28px',
  },
}

const variantMap: Record<KbdVariant, CSSProperties> = {
  default: {
    background: 'var(--elevation-3)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  subtle: {
    background: 'var(--elevation-2)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-tertiary)',
    boxShadow: 'none',
  },
  accent: {
    background: 'var(--accent-muted)',
    border: '1px solid rgba(201, 169, 110, 0.25)',
    color: 'var(--accent-100)',
    boxShadow: '0 0 8px rgba(201, 169, 110, 0.1)',
  },
  danger: {
    background: 'rgba(196, 92, 92, 0.08)',
    border: '1px solid rgba(196, 92, 92, 0.2)',
    color: 'var(--vermillion-100)',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--text-tertiary)',
    boxShadow: 'none',
  },
}

/**
 * Kbd - 键盘按键显示
 *
 * 特性：
 * - 4种尺寸（xs/sm/md/lg）
 * - 5种变体风格
 * - 支持组合键显示
 * - 主题自适应
 * - 符合 macOS/Windows 键盘视觉规范
 */
export function Kbd({
  children,
  className,
  size = 'sm',
  variant = 'default',
  keys,
  separator = '+',
  plain = false,
  style,
}: KbdProps) {
  const sizeStyle = sizeMap[size]
  const variantStyle = variantMap[variant]

  if (plain) {
    return (
      <span
        className={cn('inline-flex items-center font-mono', className)}
        style={{
          fontSize: sizeStyle.fontSize,
          color: 'var(--text-tertiary)',
          ...style,
        }}
      >
        {children}
      </span>
    )
  }

  // 组合键模式
  if (keys && keys.length > 0) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)} style={style}>
        {keys.map((key, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <kbd
              className={cn(
                'inline-flex items-center justify-center font-mono font-medium select-none',
                'transition-colors duration-150'
              )}
              style={{
                ...sizeStyle,
                ...variantStyle,
              }}
            >
              {formatKey(key)}
            </kbd>
            {i < keys.length - 1 && (
              <span
                className="text-[var(--text-tertiary)]"
                style={{ fontSize: sizeStyle.fontSize }}
              >
                {separator}
              </span>
            )}
          </span>
        ))}
      </span>
    )
  }

  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center font-mono font-medium select-none',
        'transition-colors duration-150',
        className
      )}
      style={{
        ...sizeStyle,
        ...variantStyle,
        ...style,
      }}
    >
      {typeof children === 'string' ? formatKey(children) : children}
    </kbd>
  )
}

/**
 * KbdCombo - 快捷键组合显示（便捷组件）
 */
export function KbdCombo({
  keys,
  size = 'sm',
  variant = 'default',
  className,
  separator = '+',
}: {
  keys: string[]
  size?: KbdSize
  variant?: KbdVariant
  className?: string
  separator?: ReactNode
}) {
  return (
    <Kbd
      keys={keys}
      size={size}
      variant={variant}
      className={className}
      separator={separator}
    />
  )
}

/**
 * KbdShortcut - 用于命令面板的快捷键显示
 */
export function KbdShortcut({
  shortcut,
  size = 'xs',
  className,
}: {
  shortcut: string
  size?: KbdSize
  className?: string
}) {
  const keys = shortcut.split('+')
  return (
    <Kbd
      keys={keys}
      size={size}
      variant="subtle"
      className={className}
    />
  )
}

/**
 * KbdHelp - 帮助文档中的快捷键展示
 * 包含标签和按键
 */
export function KbdHelp({
  label,
  shortcut,
  className,
}: {
  label: string
  shortcut: string
  className?: string
}) {
  const keys = shortcut.split('+')
  return (
    <div className={cn('flex items-center justify-between gap-4 py-2', className)}>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <Kbd keys={keys} size="sm" variant="default" />
    </div>
  )
}

/**
 * 格式化按键名称
 * 将系统按键名转换为显示友好的名称
 */
function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    'ctrl': 'Ctrl',
    'control': 'Ctrl',
    'cmd': '⌘',
    'command': '⌘',
    'meta': '⌘',
    'alt': 'Alt',
    'option': '⌥',
    'shift': 'Shift',
    'enter': '↵',
    'return': '↵',
    'backspace': '⌫',
    'delete': 'Del',
    'esc': 'Esc',
    'escape': 'Esc',
    'tab': 'Tab',
    'space': 'Space',
    'up': '↑',
    'down': '↓',
    'left': '←',
    'right': '→',
    'home': 'Home',
    'end': 'End',
    'pageup': 'PgUp',
    'pagedown': 'PgDn',
  }

  const lowerKey = key.toLowerCase()
  return keyMap[lowerKey] ?? key
}
