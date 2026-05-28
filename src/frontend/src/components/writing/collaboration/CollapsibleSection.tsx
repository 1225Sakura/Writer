import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { ChevronDown } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  badge?: number
  accentColor?: string
  children: React.ReactNode
}

export function CollapsibleSection({ title, icon, isExpanded, onToggle, badge, accentColor, children }: CollapsibleSectionProps) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-[var(--color-surface-base)] border transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-[0_2px_12px_color-mix(in_srgb,var(--ink-100)_12%,transparent)]"
      style={{
        borderColor: 'var(--border-default)',
        boxShadow: accentColor ? `0 0 0 1px color-mix(in srgb, ${accentColor} 3%, transparent), inset 0 1px 0 color-mix(in srgb, ${accentColor} 2%, transparent)` : undefined,
      }}
    >
      <button onClick={onToggle} aria-expanded={isExpanded} aria-controls={`section-${title.toLowerCase().replace(/\s+/g, '-')}`} className="w-full px-3 py-2.5 flex items-center gap-2.5 active:scale-[0.99] transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2">
        {icon && <span className="transition-transform duration-200 group-hover:scale-110">{icon}</span>}
        <span className="flex-1 text-left text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded-full font-medium" style={{ background: 'color-mix(in srgb, var(--color-vermillion) 20%, transparent)', color: 'var(--color-vermillion)', boxShadow: '0 0 6px color-mix(in srgb, var(--color-vermillion) 20%, transparent)' }}>
            {badge}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
      </button>
      <motion.div
        id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        className="overflow-hidden"
      >
        <div className="p-3 bg-[var(--color-surface-base)]">{children}</div>
      </motion.div>
    </div>
  )
}