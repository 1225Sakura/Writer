import * as React from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  FileQuestion,
  Search,
  Inbox,
  MessageSquareOff,
  Sparkles,
  BookOpen,
  Feather,
  PenLine,
  Compass,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { EntityIcon } from './Icon'
import { usePrefersReducedMotion } from '@/hooks'

// ============================================================
// TYPES
// ============================================================

export type EmptyStateIcon =
  | 'default'
  | 'search'
  | 'inbox'
  | 'message'
  | 'book'
  | 'character'
  | 'location'
  | 'faction'
  | 'ifline'
  | 'ai'
  | 'custom'
  | 'plus'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: EmptyStateIcon
  title?: string
  description?: string
  action?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
  typewriter?: boolean
  illustration?: boolean
  variant?: 'default' | 'notion'
}

// ============================================================
// CONFIG
// ============================================================

const iconMap: Record<
  Extract<EmptyStateIcon, 'default' | 'search' | 'inbox' | 'message' | 'ai' | 'custom' | 'plus'>,
  LucideIcon
> = {
  default: FileQuestion,
  search: Search,
  inbox: Inbox,
  message: MessageSquareOff,
  ai: Sparkles,
  custom: FileQuestion,
  plus: Plus,
}

const entityIconTypes: Record<string, 'world' | 'character' | 'location' | 'faction' | 'rule' | 'outline' | 'ifline'> = {
  book: 'outline',
  character: 'character',
  location: 'location',
  faction: 'faction',
  ifline: 'ifline',
}

const sizeConfig = {
  sm: { icon: 32, title: 'text-sm', desc: 'text-xs', spacing: 'py-6' },
  md: { icon: 48, title: 'text-base', desc: 'text-sm', spacing: 'py-10' },
  lg: { icon: 64, title: 'text-lg', desc: 'text-base', spacing: 'py-16' },
}

// ============================================================
// DECORATIVE ILLUSTRATION
// ============================================================

function DecorativeIllustration({
  icon,
  size,
}: {
  icon: EmptyStateIcon
  size: 'sm' | 'md' | 'lg'
}) {
  const config = sizeConfig[size]
  const containerSize = config.icon * 2.5
  const s = config.icon * 0.5
  const iconColor = 'var(--text-tertiary)'
  const accentColor = 'var(--accent-primary)'

  const getIllustration = () => {
    switch (icon) {
      case 'search':
        return (
          <>
            <motion.div className="absolute" style={{ top: '15%', left: '20%' }} animate={{ y: [0, -4, 0], rotate: [0, 5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
              <Search size={s * 1.2} style={{ color: accentColor, opacity: 0.7 }} strokeWidth={1.5} />
            </motion.div>
            <motion.div className="absolute" style={{ bottom: '20%', right: '18%' }} animate={{ y: [0, 3, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}>
              <Compass size={s * 0.7} style={{ color: iconColor, opacity: 0.5 }} strokeWidth={1.5} />
            </motion.div>
            <motion.div className="absolute" style={{ top: '25%', right: '22%' }} animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}>
              <Sparkles size={s * 0.6} style={{ color: accentColor, opacity: 0.4 }} strokeWidth={1.5} />
            </motion.div>
          </>
        )
      case 'book':
      case 'ai':
        return (
          <>
            <motion.div className="absolute" style={{ top: '18%', left: '22%' }} animate={{ y: [0, -3, 0], rotate: [-5, 5, -5] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
              <BookOpen size={s * 1.1} style={{ color: accentColor, opacity: 0.7 }} strokeWidth={1.5} />
            </motion.div>
            <motion.div className="absolute" style={{ bottom: '22%', right: '20%' }} animate={{ y: [0, 4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}>
              <Feather size={s * 0.8} style={{ color: iconColor, opacity: 0.5 }} strokeWidth={1.5} />
            </motion.div>
            <motion.div className="absolute" style={{ top: '30%', right: '18%' }} animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}>
              <PenLine size={s * 0.6} style={{ color: accentColor, opacity: 0.4 }} strokeWidth={1.5} />
            </motion.div>
          </>
        )
      default:
        return (
          <>
            <motion.div className="absolute" style={{ top: '20%', left: '25%' }} animate={{ y: [0, -5, 0], rotate: [0, 8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}>
              <FileQuestion size={s * 1.2} style={{ color: accentColor, opacity: 0.6 }} strokeWidth={1.5} />
            </motion.div>
            <motion.div className="absolute" style={{ bottom: '25%', right: '22%' }} animate={{ y: [0, 3, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}>
              <Sparkles size={s * 0.7} style={{ color: iconColor, opacity: 0.4 }} strokeWidth={1.5} />
            </motion.div>
            <motion.div className="absolute" style={{ top: '30%', right: '20%' }} animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}>
              <Compass size={s * 0.5} style={{ color: accentColor, opacity: 0.3 }} strokeWidth={1.5} />
            </motion.div>
          </>
        )
    }
  }

  return (
    <motion.div
      className="relative flex items-center justify-center rounded-[var(--radius-xl)] mb-4"
      style={{
        width: containerSize,
        height: containerSize,
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="absolute inset-0 rounded-[var(--radius-xl)] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, var(--accent-muted) 0%, transparent 70%)',
        }}
      />
      {getIllustration()}
    </motion.div>
  )
}

// ============================================================
// MAIN EMPTY STATE COMPONENT
// ============================================================

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      icon = 'default',
      title,
      description,
      action,
      size = 'md',
      animated = true,
      illustration = false,
      variant = 'default',
      ...props
    },
    ref
  ) => {
    const config = sizeConfig[size]
    const isEntityIcon = icon in entityIconTypes
    const isNotionStyle = variant === 'notion'
    const reducedMotion = usePrefersReducedMotion()
    const shouldAnimate = animated && !reducedMotion

    const Wrapper = shouldAnimate ? motion.div : 'div'
    const wrapperProps = shouldAnimate
      ? { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
      : {}

    // Notion-style variant
    if (isNotionStyle) {
      const notionIconSize = size === 'sm' ? 32 : size === 'md' ? 48 : 64
      return (
        <Wrapper
          ref={ref as any}
          className={cn('flex flex-col items-center justify-center text-center px-4', config.spacing, className)}
          {...(wrapperProps as any)}
          {...props}
        >
          <div
            className="relative flex items-center justify-center rounded-xl mb-4"
            style={{
              width: notionIconSize * 2,
              height: notionIconSize * 2,
              border: '2px dashed var(--border-strong)',
              backgroundColor: 'transparent',
            }}
          >
            <Plus size={notionIconSize} style={{ color: 'var(--vermillion-100)' }} strokeWidth={1.5} />
          </div>
          {title && <h3 className={cn(config.title, 'font-semibold text-[var(--text-primary)] mb-1.5')}>{title}</h3>}
          {description && (
            <p className={cn(config.desc, 'text-[var(--text-tertiary)] max-w-[280px] leading-relaxed')}>{description}</p>
          )}
          {action && <div className="mt-4">{action}</div>}
        </Wrapper>
      )
    }

    // Standard variant
    return (
      <Wrapper
        ref={ref as any}
        className={cn('flex flex-col items-center justify-center text-center px-4', config.spacing, className)}
        {...(wrapperProps as any)}
        {...props}
      >
        {illustration ? (
          <DecorativeIllustration icon={icon} size={size} />
        ) : (
          <div
            className={cn(
              'relative flex items-center justify-center rounded-[var(--radius-xl)] mb-4',
              'bg-[var(--color-surface-raised)] border border-[var(--border-default)]'
            )}
            style={{ width: config.icon * 2, height: config.icon * 2 }}
          >
            {isEntityIcon ? (
              <EntityIcon
                type={entityIconTypes[icon]}
                size={size === 'sm' ? 'sm' : size === 'md' ? 'md' : 'lg'}
                className="text-[var(--text-tertiary)]"
                style={{ strokeWidth: 1.5 }}
              />
            ) : (
              (() => {
                const LucideIconComponent = iconMap[icon as keyof typeof iconMap]
                return (
                  <LucideIconComponent
                    size={config.icon}
                    className="text-[var(--text-tertiary)]"
                    strokeWidth={1.5}
                  />
                )
              })()
            )}
            <div
              className="absolute inset-0 rounded-[var(--radius-xl)] pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 50%, var(--accent-muted) 0%, transparent 70%)',
              }}
            />
          </div>
        )}

        {title && <h3 className={cn(config.title, 'font-semibold text-[var(--text-primary)] mb-1.5')}>{title}</h3>}
        {description && (
          <p className={cn(config.desc, 'text-[var(--text-tertiary)] max-w-[280px] leading-relaxed')}>{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </Wrapper>
    )
  }
)

EmptyState.displayName = 'EmptyState'
