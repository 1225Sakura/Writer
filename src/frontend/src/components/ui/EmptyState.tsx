import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'
import {
  FileQuestion,
  Search,
  Inbox,
  MessageSquareOff,
  BookOpen,
  Users,
  MapPin,
  Swords,
  GitBranch,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

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

const iconMap: Record<EmptyStateIcon, LucideIcon> = {
  default: FileQuestion,
  search: Search,
  inbox: Inbox,
  message: MessageSquareOff,
  book: BookOpen,
  character: Users,
  location: MapPin,
  faction: Swords,
  ifline: GitBranch,
  ai: Sparkles,
  custom: FileQuestion,
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
    const Icon = iconMap[icon]
    const config = sizeConfig[size]

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
            'relative flex items-center justify-center rounded-2xl mb-4',
            'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]'
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
          <Icon
            size={config.icon}
            className="text-[rgba(255,255,255,0.2)]"
            strokeWidth={1.5}
          />
          {/* Subtle inner glow */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(94, 106, 210, 0.05) 0%, transparent 70%)',
            }}
          />
        </motion.div>

        {title && (
          <motion.h3
            className={clsx(
              config.title,
              'font-semibold text-[#d0d6e0] mb-1.5'
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
              'text-[#8a8f98] max-w-[280px] leading-relaxed'
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
