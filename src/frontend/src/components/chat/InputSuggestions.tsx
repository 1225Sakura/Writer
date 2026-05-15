import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Wand2, Lightbulb, FileText } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { ChatTemplates } from './ChatTemplates'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const quickReplies = [
  { label: '继续', icon: <Icon icon={Zap} size="xs" />, message: '继续' },
  { label: '详细点', icon: <Icon icon={Wand2} size="xs" />, message: '请说得更详细一些' },
  { label: '换个思路', icon: <Icon icon={Lightbulb} size="xs" />, message: '换个思路' },
]

interface InputSuggestionsProps {
  hasMessages: boolean
  isLoading: boolean
  isStreaming: boolean
  showExportConfirm: boolean
  onTemplateSelect: (message: string) => void
  onQuickReply: (message: string) => void
  onExportOutline: () => void
}

export function InputSuggestions({
  hasMessages,
  isLoading,
  isStreaming,
  showExportConfirm,
  onTemplateSelect,
  onQuickReply,
  onExportOutline,
}: InputSuggestionsProps) {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <>
      {/* Template selector + Export button row */}
      <div className="flex items-center justify-between">
        <ChatTemplates onSelect={onTemplateSelect} disabled={isLoading || isStreaming} />

        {hasMessages && (
          <motion.button
            onClick={onExportOutline}
            disabled={isLoading || isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-default
                       text-secondary hover:bg-surface-raised hover:text-primary
                       active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed touch-target-min"
            whileHover={prefersReducedMotion ? {} : { y: -1, boxShadow: 'var(--shadow-card)' }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
          >
            <Icon icon={FileText} size="sm" />
            <span>生成大纲</span>
          </motion.button>
        )}
      </div>

      {/* Export confirmation toast */}
      <AnimatePresence>
        {showExportConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg
                       bg-[color-mix(in_srgb,var(--color-ifline)_10%,transparent)] text-[var(--color-ifline)] border border-[color-mix(in_srgb,var(--color-ifline)_20%,transparent)]"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </motion.div>
            大纲已生成！请前往设定界面查看。
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick reply buttons */}
      <AnimatePresence>
        {hasMessages && !isLoading && !isStreaming && (
          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
          >
            {quickReplies.map((reply) => (
              <GlassCard
                key={reply.label}
                intensity="light"
                border="subtle"
                variant="default"
                rounded="full"
                padding="sm"
                hover
                className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-secondary hover:text-primary"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => onQuickReply(reply.message)}
              >
                <span className="flex-shrink-0 opacity-60">{reply.icon}</span>
                <span>{reply.label}</span>
              </GlassCard>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
