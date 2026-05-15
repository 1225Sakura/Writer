/**
 * ChapterSummaryModal — Modal for editing chapter summaries.
 * Extracted from EntityActions.tsx.
 */

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { FloatingLabelTextarea, SaveStateIndicator, type ValidationState } from './EntityFieldGroup'
import type { Chapter } from '@/shared/types'

export function ChapterSummaryModal({
  chapter,
  onSave,
  onClose,
}: {
  chapter: Chapter
  onSave: (summary: string) => void
  onClose: () => void
}) {
  const [summary, setSummary] = useState(chapter.summary || '')
  const [saveState, setSaveState] = useState<ValidationState>('idle')

  const handleSave = () => {
    setSaveState('saving')
    setTimeout(() => {
      onSave(summary)
      setSaveState('saved')
    }, 200)
  }

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-lg p-5"
        style={{ backgroundColor: 'var(--color-surface-base)', border: '1px solid var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            编辑章节摘要
          </h3>
          <motion.button
            onClick={onClose}
            className="p-1 rounded transition-all"
            style={{ color: 'var(--text-tertiary)' }}
            whileHover={{
              backgroundColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
            whileTap={{ scale: 0.9 }}
          >
            <Icon icon={X} size="sm" color="inherit" />
          </motion.button>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
          {chapter.title}
        </p>
        <FloatingLabelTextarea
          value={summary}
          onChange={setSummary}
          placeholder="编写章节摘要..."
          label="摘要"
          rows={4}
          maxLength={500}
        />
        <div className="flex items-center justify-between mt-4">
          <SaveStateIndicator state={saveState} />
          <div className="flex gap-2">
            <motion.button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-default)',
              }}
              whileTap={{ scale: 0.97 }}
            >
              取消
            </motion.button>
            <motion.button
              onClick={handleSave}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2"
              style={{ backgroundColor: 'var(--color-outline)', color: 'var(--text-primary)' }}
              whileTap={{ scale: 0.97 }}
            >
              <Icon icon={Save} size="sm" color="inherit" />
              保存
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
