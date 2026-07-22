import { useAIStore } from '@/store'
import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Zap,
  Expand,
  Shrink,
  RefreshCw,
  ArrowRight,
  Paintbrush,
} from 'lucide-react'
import { showToast } from '@/components/ui/Toast'
import { getEditorInstance } from '@/store/editorRegistry'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

interface QuickOpDef {
  key: string
  label: string
  icon: React.ReactNode
  shortcut: string
  color: string
}

const QUICK_OPERATIONS: QuickOpDef[] = [
  { key: 'optimize', label: '优化', icon: <Zap className="w-3.5 h-3.5" />, shortcut: 'O', color: 'var(--accent-primary)' },
  { key: 'expand', label: '扩写', icon: <Expand className="w-3.5 h-3.5" />, shortcut: 'E', color: 'var(--color-ifline)' },
  { key: 'condense', label: '缩写', icon: <Shrink className="w-3.5 h-3.5" />, shortcut: 'S', color: 'var(--color-character)' },
  { key: 'rewrite', label: '改写', icon: <RefreshCw className="w-3.5 h-3.5" />, shortcut: 'R', color: 'var(--color-item)' },
  { key: 'continue', label: '续写', icon: <ArrowRight className="w-3.5 h-3.5" />, shortcut: 'W', color: 'var(--color-location)' },
  { key: 'polish', label: '润色', icon: <Paintbrush className="w-3.5 h-3.5" />, shortcut: 'P', color: 'var(--color-vermillion)' },
] as const

export function QuickAIOperations() {
  const { loading, optimize, expand, condense: shrink, rewrite, continue: continueWriting, polish } = useAIStore()
  const [showQuickAIOps, setShowQuickAIOps] = useState(false)
  const [quickOpLoading, setQuickOpLoading] = useState<string | null>(null)

  const isAIGenerating = loading.ai

  const handleQuickAIOp = async (
    operation: 'optimize' | 'expand' | 'condense' | 'rewrite' | 'continue' | 'polish'
  ) => {
    const editor = getEditorInstance()
    const selectedText = editor
      ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
      : ''

    if (!selectedText) {
      showToast('请先选中需要操作的文字', 'warning')
      return
    }

    setQuickOpLoading(operation)
    try {
      let result: string
      switch (operation) {
        case 'optimize':
          result = await optimize(selectedText)
          break
        case 'expand':
          result = await expand(selectedText)
          break
        case 'condense':
          result = await shrink(selectedText)
          break
        case 'rewrite':
          result = await rewrite(selectedText)
          break
        case 'continue':
          result = await continueWriting(selectedText)
          break
        case 'polish':
          result = await polish(selectedText)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      if (editor && result) {
        editor.commands.insertContent(result)
        showToast(`${operation}完成`, 'success')
      }
    } catch (_error) {
      showToast(`${operation}失败`, 'error')
    } finally {
      setQuickOpLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0 relative">
      <QuickAIButton
        onClick={() => setShowQuickAIOps(!showQuickAIOps)}
        isActive={showQuickAIOps}
        isLoading={isAIGenerating}
      />

      <AnimatePresence>
        {showQuickAIOps && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            className="absolute top-full left-0 mt-1.5 z-50 p-1.5 rounded-xl shadow-2xl min-w-[200px]"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-float)',
            }}
          >
            <div
              className="text-[10px] px-2 py-1 uppercase tracking-wider font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              选中文字后执行
            </div>
            <div className="grid grid-cols-2 gap-0.5">
              {QUICK_OPERATIONS.map((op) => (
                <QuickOpButton
                  key={op.key}
                  op={op}
                  isLoading={quickOpLoading === op.key}
                  isDisabled={quickOpLoading !== null}
                  onClick={() => {
                    handleQuickAIOp(op.key as 'optimize' | 'expand' | 'condense' | 'rewrite' | 'continue' | 'polish')
                    setShowQuickAIOps(false)
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const QuickAIButton = memo(function QuickAIButton({
  onClick,
  isActive,
  isLoading,
}: {
  onClick: () => void
  isActive: boolean
  isLoading: boolean
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={isLoading}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex-shrink-0 disabled:opacity-60 ${
        isActive
          ? 'text-[var(--text-primary)]'
          : 'text-[var(--accent-primary)] hover:bg-[color-mix(in_srgb,var(--accent-primary)_18%,transparent)] hover:shadow-[0_0_12px_color-mix(in_srgb,var(--accent-primary)_20%,transparent)]'
      }`}
      style={isActive ? {
        background: 'var(--accent-primary)',
        border: '1px solid color-mix(in srgb, var(--accent-primary) 50%, transparent)',
        boxShadow: '0 0 16px color-mix(in srgb, var(--accent-primary) 30%, transparent)',
      } : {
        background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
        boxShadow: '0 0 8px color-mix(in srgb, var(--accent-primary) 10%, transparent)',
      }}
    >
      {isLoading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </motion.div>
      ) : (
        <Zap className="w-3.5 h-3.5" />
      )}
      <span>快捷AI</span>
      {isLoading && (
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse motion-reduce:animate-none"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        />
      )}
    </motion.button>
  )
})

const QuickOpButton = memo(function QuickOpButton({
  op,
  isLoading,
  isDisabled,
  onClick,
}: {
  op: QuickOpDef
  isLoading: boolean
  isDisabled: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={isDisabled}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
        isLoading ? '' : 'hover:bg-[var(--color-surface-base)]'
      }`}
      style={{
        color: 'var(--text-secondary)',
        background: isLoading
          ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)'
          : 'transparent',
      }}
    >
      <span className="inline-flex items-center justify-center shrink-0" style={{ color: op.color }}>
        {op.icon}
      </span>
      <span className="flex-1 text-left font-medium">{op.label}</span>
      <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
        ⇧{op.shortcut}
      </span>
    </motion.button>
  )
})
