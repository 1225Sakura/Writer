import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, Zap, Expand, Shrink } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { useAIStore } from '@/store'
import { showToast } from '@/components/ui/Toast'
import { getEditorInstance } from '@/store/editorRegistry'

/** Get the paragraph text at the current cursor position. */
function getParagraphAtCursor() {
  const editor = getEditorInstance()
  if (!editor) return null
  const { state } = editor
  const { selection } = state
  const { $from } = selection

  const depth = $from.depth
  for (let d = depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node.isBlock && node.textContent.trim()) {
      const startPos = $from.start(d)
      const endPos = $from.end(d)
      const text = state.doc.textBetween(startPos, endPos, '\n')
      const cursorPos = selection.from
      const isAtEnd = cursorPos >= endPos - 2
      return { text, isAtEnd }
    }
  }
  return null
}

interface FloatingAction {
  key: string
  label: string
  icon: React.ReactNode
  color: string
}

const FLOATING_ACTIONS: FloatingAction[] = [
  { key: 'continue', label: '续写', icon: <ArrowRight className="w-4 h-4" />, color: 'var(--color-location)' },
  { key: 'optimize', label: '优化', icon: <Zap className="w-4 h-4" />, color: 'var(--accent-primary)' },
  { key: 'expand', label: '扩写', icon: <Expand className="w-4 h-4" />, color: 'var(--color-ifline)' },
  { key: 'condense', label: '缩写', icon: <Shrink className="w-4 h-4" />, color: 'var(--color-character)' },
]

export function FloatingToolBar() {
  const [expanded, setExpanded] = useState(false)
  const [activeOp, setActiveOp] = useState<string | null>(null)
  const { optimize, expand, condense: shrink, continue: continueWriting } = useAIStore()

  const handleOperation = async (opKey: string) => {
    const editor = getEditorInstance()
    let selectedText = editor
      ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
      : ''

    if (!selectedText) {
      const paragraph = getParagraphAtCursor()
      if (!paragraph || !paragraph.text.trim()) {
        showToast('请先选中文字或将光标放在段落中', 'warning')
        return
      }
      selectedText = paragraph.text
    }

    setActiveOp(opKey)
    try {
      let result: string
      switch (opKey) {
        case 'optimize':
          result = await optimize(selectedText)
          break
        case 'expand':
          result = await expand(selectedText)
          break
        case 'condense':
          result = await shrink(selectedText)
          break
        case 'continue':
          result = await continueWriting(selectedText)
          break
        default:
          throw new Error(`Unknown operation: ${opKey}`)
      }

      if (editor && result) {
        editor.commands.insertContent(result)
        showToast(`${FLOATING_ACTIONS.find(a => a.key === opKey)?.label ?? opKey}完成`, 'success')
      }
    } catch {
      showToast(`${FLOATING_ACTIONS.find(a => a.key === opKey)?.label ?? opKey}失败`, 'error')
    } finally {
      setActiveOp(null)
    }
  }

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5"
      initial={{ opacity: 0, scale: 0.8, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 16 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    >
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="flex items-center gap-1 p-1.5 rounded-2xl"
            initial={{ opacity: 0, x: 16, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 16, scale: 0.9 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-float)',
            }}
          >
            {FLOATING_ACTIONS.map((action, i) => (
              <motion.button
                key={action.key}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: DURATION.FAST, delay: i * 0.04 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleOperation(action.key)}
                disabled={activeOp !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                style={{
                  color: activeOp === action.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: activeOp === action.key
                    ? 'color-mix(in srgb, var(--accent-primary) 18%, transparent)'
                    : 'transparent',
                }}
                title={action.label}
              >
                <span style={{ color: action.color }}>
                  {activeOp === action.key ? (
                    <motion.span
                      className="inline-flex"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      {action.icon}
                    </motion.span>
                  ) : (
                    action.icon
                  )}
                </span>
                <span>{action.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center justify-center w-11 h-11 rounded-full transition-shadow"
        style={{
          background: expanded
            ? 'var(--accent-primary)'
            : 'color-mix(in srgb, var(--accent-primary) 20%, var(--color-surface-raised))',
          border: '1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent)',
          boxShadow: expanded
            ? '0 0 20px color-mix(in srgb, var(--accent-primary) 35%, transparent)'
            : '0 2px 12px rgba(0,0,0,0.15)',
          color: expanded ? 'var(--text-primary)' : 'var(--accent-primary)',
        }}
        title={expanded ? '收起工具条' : '展开快捷AI操作'}
      >
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
        >
          <Sparkles className="w-5 h-5" />
        </motion.div>
      </motion.button>
    </motion.div>
  )
}
