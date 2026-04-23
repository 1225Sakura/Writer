import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'
import {
  FileQuestion,
  Search,
  Inbox,
  MessageSquareOff,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { EntityIcon } from './Icon'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: EmptyStateIcon
  title?: string
  description?: string
  action?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
}

type EmptyStateIcon =
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

const iconMap: Record<Extract<EmptyStateIcon, 'default' | 'search' | 'inbox' | 'message' | 'ai' | 'custom'>, LucideIcon> = {
  default: FileQuestion,
  search: Search,
  inbox: Inbox,
  message: MessageSquareOff,
  ai: Sparkles,
  custom: FileQuestion,
}

const entityIconTypes: Record<string, 'world' | 'character' | 'location' | 'faction' | 'rule' | 'outline' | 'ifline'> = {
  book: 'outline',
  character: 'character',
  location: 'location',
  faction: 'faction',
  ifline: 'ifline',
}

const sizeConfig = {
  sm: {
    icon: 32,
    title: 'text-sm',
    desc: 'text-xs',
    spacing: 'py-6',
  },
  md: {
    icon: 48,
    title: 'text-base',
    desc: 'text-sm',
    spacing: 'py-10',
  },
  lg: {
    icon: 64,
    title: 'text-lg',
    desc: 'text-base',
    spacing: 'py-16',
  },
}

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
      ...props
    },
    ref
  ) => {
    const config = sizeConfig[size]
    const isEntityIcon = icon in entityIconTypes

    const Wrapper = animated ? motion.div : 'div'
    const wrapperProps = animated
      ? {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
        }
      : {}

    return (
      <Wrapper
        ref={ref as any}
        className={twMerge(
          clsx(
            'flex flex-col items-center justify-center text-center',
            config.spacing,
            'px-4'
          ),
          className
        )}
        {...(wrapperProps as any)}
        {...props}
      >
        {/* Icon container with subtle glow */}
        <motion.div
          className={clsx(
            'relative flex items-center justify-center rounded-[var(--radius-xl)] mb-4',
            'bg-[var(--color-surface-raised)] border border-[var(--border-default)]'
          )}
          style={{ width: config.icon * 2, height: config.icon * 2 }}
          {...(animated
            ? {
                initial: { scale: 0.8, opacity: 0 },
                animate: { scale: 1, opacity: 1 },
                transition: { duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] },
              }
            : {})}
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
          {/* Subtle inner glow */}
          <div
            className="absolute inset-0 rounded-[var(--radius-xl)] pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, var(--accent-muted) 0%, transparent 70%)',
            }}
          />
        </motion.div>

        {title && (
          <motion.h3
            className={clsx(
              config.title,
              'font-semibold text-[var(--text-primary)] mb-1.5'
            )}
            {...(animated
              ? {
                  initial: { opacity: 0, y: 8 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.4, delay: 0.2 },
                }
              : {})}
          >
            {title}
          </motion.h3>
        )}

        {description && (
          <motion.p
            className={clsx(
              config.desc,
              'text-[var(--text-tertiary)] max-w-[280px] leading-relaxed'
            )}
            {...(animated
              ? {
                  initial: { opacity: 0, y: 8 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.4, delay: 0.3 },
                }
              : {})}
          >
            {description}
          </motion.p>
        )}

        {action && (
          <motion.div
            className="mt-4"
            {...(animated
              ? {
                  initial: { opacity: 0, y: 8 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.4, delay: 0.4 },
                }
              : {})}
          >
            {action}
          </motion.div>
        )}
      </Wrapper>
    )
  }
)
EmptyState.displayName = 'EmptyState'
