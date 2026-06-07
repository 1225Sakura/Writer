/**
 * FirstTimeHint - First-use onboarding hints
 *
 * Shows 3 key functional hints on first open, persisted via localStorage.
 * Once dismissed, never shown again.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelLeft, PanelRight, Download, X, Lightbulb } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE, STAGGER_CONTAINER, STAGGER_ITEM } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const STORAGE_KEY = 'writer-first-time-hint-dismissed'

interface Hint {
  id: string
  icon: React.ElementType
  title: string
  description: string
}

const hints: Hint[] = [
  {
    id: 'left-panel',
    icon: PanelLeft,
    title: '左侧面板',
    description: '查看 AI 收集的设定信息，点击可确认或编辑',
  },
  {
    id: 'right-panel',
    icon: PanelRight,
    title: '右侧面板',
    description: '展开 AI 操作面板，使用快捷指令辅助写作',
  },
  {
    id: 'export',
    icon: Download,
    title: '导出功能',
    description: '完成设定后，点击底部「生成大纲」导出到设定编辑器',
  },
]

export function FirstTimeHint() {
  const [visible, setVisible] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY)
      if (!dismissed) {
        setVisible(true)
      }
    } catch {
      // localStorage unavailable, show hint anyway
      setVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // silently fail
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
          className="mb-3"
        >
          <GlassCard
            intensity="light"
            border="subtle"
            variant="default"
            rounded="xl"
            padding="md"
            className="relative"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center bg-accent-primary/10">
                  <Lightbulb className="w-3.5 h-3.5 text-accent-primary" />
                </div>
                <span className="text-xs font-medium text-primary">快速上手</span>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-md text-tertiary hover:text-primary hover:bg-surface-hover transition-colors"
                aria-label="关闭提示"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hint items */}
            <motion.div
              className="space-y-2"
              variants={prefersReducedMotion ? {} : STAGGER_CONTAINER}
              initial="hidden"
              animate="visible"
            >
              {hints.map((hint) => {
                const Icon = hint.icon
                return (
                  <motion.div
                    key={hint.id}
                    variants={prefersReducedMotion ? {} : STAGGER_ITEM}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface-hover transition-colors"
                  >
                    <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5
                                    bg-accent-primary/8">
                      <Icon className="w-3 h-3 text-accent-primary/60" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-primary block">{hint.title}</span>
                      <span className="text-[11px] text-secondary leading-relaxed">{hint.description}</span>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Dismiss all button */}
            <motion.button
              onClick={handleDismiss}
              className="mt-3 w-full py-1.5 text-[11px] text-tertiary hover:text-primary
                         rounded-lg hover:bg-surface-hover transition-colors"
              whileHover={prefersReducedMotion ? {} : { scale: 1.01 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
            >
              知道了，不再显示
            </motion.button>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
