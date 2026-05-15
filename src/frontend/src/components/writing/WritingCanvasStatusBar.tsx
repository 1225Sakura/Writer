/**
 * WritingCanvasStatusBar - Bottom status bar with typing indicator and save status
 */

import { AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { SaveStatusIndicator } from './editor/EditorArea'
import { WritingTypingIndicator } from './editor/WritingTypingIndicator'
import type { AutoSaveState } from '@/store/writingStore'

interface WritingCanvasStatusBarProps {
  saveStatus: AutoSaveState
  lastSavedAt: number | null
  isTyping: boolean
  loading: { ai: boolean; checkers: boolean }
}

export function WritingCanvasStatusBar({
  saveStatus,
  lastSavedAt,
  isTyping,
  loading,
}: WritingCanvasStatusBarProps) {
  return (
    <div
      className="flex items-center px-5 py-2 text-xs font-medium"
      style={{
        background: 'var(--color-surface-raised)',
        borderTop: '1px solid var(--border-default)',
        color: 'var(--text-tertiary)',
        minHeight: '32px',
      }}
    >
      <div className="ml-auto flex items-center gap-3">
        <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />

        <AnimatePresence>
          {isTyping && <WritingTypingIndicator isTyping={isTyping} />}
        </AnimatePresence>

        {loading.ai && (
          <span className="flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse motion-reduce:animate-none" style={{ backgroundColor: 'var(--accent-primary)' }} />
            AI处理中...
          </span>
        )}

        {loading.checkers && (
          <span className="flex items-center gap-1" style={{ color: 'var(--color-outline)' }}>
            <Loader2 className="w-3 h-3 animate-spin motion-reduce:animate-none" />
            检查中...
          </span>
        )}
      </div>
    </div>
  )
}
