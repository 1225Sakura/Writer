/**
 * SelectionAIMenu - Floating AI operations toolbar on text selection
 *
 * Appears below the existing EditorToolbar when text is selected.
 * Shows 6 AI operation buttons + a custom input field for arbitrary prompts.
 * Uses the same positioning and animation patterns as EditorToolbar.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Maximize2,
  Minimize2,
  RefreshCw,
  ArrowRight,
  Paintbrush,
  Send,
  X,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { useAIStore } from '@/store'
import { showToast } from '@/components/ui/Toast'
import type { Editor } from '@tiptap/react'

interface SelectionAIMenuProps {
  editor: Editor | null
}

/** AI operation definition */
interface AIOp {
  id: 'optimize' | 'expand' | 'condense' | 'rewrite' | 'continue' | 'polish'
  label: string
  icon: React.ReactNode
  shortcut?: string
}

const AI_OPERATIONS: AIOp[] = [
  {
    id: 'optimize',
    label: '优化',
    icon: <Icon icon={Sparkles} size="xs" />,
    shortcut: 'Ctrl+Shift+O',
  },
  {
    id: 'expand',
    label: '扩写',
    icon: <Icon icon={Maximize2} size="xs" />,
    shortcut: 'Ctrl+Shift+E',
  },
  {
    id: 'condense',
    label: '缩写',
    icon: <Icon icon={Minimize2} size="xs" />,
    shortcut: 'Ctrl+Shift+S',
  },
  {
    id: 'rewrite',
    label: '改写',
    icon: <Icon icon={RefreshCw} size="xs" />,
    shortcut: 'Ctrl+Shift+R',
  },
  {
    id: 'continue',
    label: '续写',
    icon: <Icon icon={ArrowRight} size="xs" />,
    shortcut: 'Ctrl+Shift+W',
  },
  {
    id: 'polish',
    label: '润色',
    icon: <Icon icon={Paintbrush} size="xs" />,
    shortcut: 'Ctrl+Shift+P',
  },
]

export function SelectionAIMenu({ editor }: SelectionAIMenuProps) {
  const [visible, setVisible] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [selectionFrom, setSelectionFrom] = useState(0)
  const [selectionTo, setSelectionTo] = useState(0)
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const aiStore = useAIStore()

  // Track selection changes
  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      const hasSelection = from !== to
      const isEmpty = editor.isEmpty

      if (hasSelection && !isEmpty) {
        const text = editor.state.doc.textBetween(from, to, ' ')
        setSelectedText(text)
        setSelectionFrom(from)
        setSelectionTo(to)
        setVisible(true)
      } else {
        setVisible(false)
        setShowCustomInput(false)
        setCustomInput('')
      }
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.on('focus', handleSelectionUpdate)
    editor.on('blur', () => {
      // Delay hide to allow clicking buttons
      setTimeout(() => {
        if (!showCustomInput) {
          setVisible(false)
        }
      }, 200)
    })

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      editor.off('focus', handleSelectionUpdate)
    }
  }, [editor, showCustomInput])

  // Focus input when custom input is shown
  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showCustomInput])

  /** Execute an AI operation on the selected text */
  const executeOperation = useCallback(
    async (opId: AIOp['id']) => {
      if (!editor || !selectedText.trim() || isProcessing) return

      setIsProcessing(true)
      try {
        const action = aiStore[opId]
        const result = await action(selectedText)

        if (result && result.trim()) {
          // Replace selected text with the result
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              tr.delete(selectionFrom, selectionTo)
              tr.insertText(result, selectionFrom)
              return true
            })
            .run()

          showToast(`AI ${AI_OPERATIONS.find((o) => o.id === opId)?.label}完成`, 'success')
        }
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'AI操作失败，请重试'
        showToast(msg, 'error')
      } finally {
        setIsProcessing(false)
      }
    },
    [editor, selectedText, selectionFrom, selectionTo, isProcessing, aiStore]
  )

  /** Execute custom prompt on selected text */
  const executeCustomPrompt = useCallback(async () => {
    if (!editor || !selectedText.trim() || !customInput.trim() || isProcessing)
      return

    setIsProcessing(true)
    try {
      // Use 'rewrite' as the operation for custom prompts
      const result = await aiStore.rewrite(
        `[指令: ${customInput}]\n${selectedText}`
      )

      if (result && result.trim()) {
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.delete(selectionFrom, selectionTo)
            tr.insertText(result, selectionFrom)
            return true
          })
          .run()

        showToast('AI操作完成', 'success')
      }

      setShowCustomInput(false)
      setCustomInput('')
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'AI操作失败，请重试'
      showToast(msg, 'error')
    } finally {
      setIsProcessing(false)
    }
  }, [
    editor,
    selectedText,
    customInput,
    selectionFrom,
    selectionTo,
    isProcessing,
    aiStore,
  ])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!visible || !editor) return

    const handler = (e: KeyboardEvent) => {
      // Enter in custom input
      if (
        e.key === 'Enter' &&
        showCustomInput &&
        document.activeElement === inputRef.current
      ) {
        e.preventDefault()
        executeCustomPrompt()
        return
      }

      // Escape closes custom input
      if (e.key === 'Escape' && showCustomInput) {
        e.preventDefault()
        setShowCustomInput(false)
        setCustomInput('')
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [visible, editor, showCustomInput, executeCustomPrompt])

  if (!editor) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1"
        >
          {/* Main toolbar */}
          <div
            className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-xl"
            style={{
              background: `linear-gradient(180deg, color-mix(in srgb, var(--ink-100) 92%, transparent) 0%, color-mix(in srgb, var(--ink-100) 96%, transparent) 100%)`,
              border: `1px solid color-mix(in srgb, var(--paper-100) 8%, transparent)`,
              boxShadow: `0 8px 32px color-mix(in srgb, var(--ink-100) 28%, transparent), 0 4px 12px color-mix(in srgb, var(--ink-100) 16%, transparent), inset 0 1px 0 color-mix(in srgb, var(--paper-100) 6%, transparent)`,
            }}
            role="toolbar"
            aria-label="AI操作工具栏"
          >
            {/* AI label */}
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded mr-1"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--color-outline) 20%, transparent)',
                color: 'var(--color-outline)',
              }}
            >
              AI
            </span>

            {/* Operation buttons */}
            {AI_OPERATIONS.map((op, i) => (
              <div key={op.id} className="flex items-center">
                {i > 0 && (
                  <div
                    className="w-px h-4 mx-0.5"
                    style={{
                      background:
                        'linear-gradient(180deg, transparent, color-mix(in srgb, var(--paper-100) 12%, transparent), transparent)',
                    }}
                  />
                )}
                <button
                  onClick={() => executeOperation(op.id)}
                  disabled={isProcessing}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all duration-150"
                  style={{
                    color: isProcessing
                      ? 'var(--paper-30)'
                      : 'var(--paper-70)',
                    opacity: isProcessing ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isProcessing) {
                      e.currentTarget.style.backgroundColor =
                        'color-mix(in srgb, var(--paper-100) 8%, transparent)'
                      e.currentTarget.style.color = 'var(--paper-90)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = isProcessing
                      ? 'var(--paper-30)'
                      : 'var(--paper-70)'
                  }}
                  title={`${op.label}${op.shortcut ? ` (${op.shortcut})` : ''}`}
                  aria-label={op.label}
                >
                  {op.icon}
                  <span>{op.label}</span>
                </button>
              </div>
            ))}

            {/* Divider before custom input toggle */}
            <div
              className="w-px h-4 mx-0.5"
              style={{
                background:
                  'linear-gradient(180deg, transparent, color-mix(in srgb, var(--paper-100) 12%, transparent), transparent)',
              }}
            />

            {/* Custom input toggle */}
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              disabled={isProcessing}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all duration-150"
              style={{
                color: showCustomInput
                  ? 'var(--color-outline)'
                  : 'var(--paper-70)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  'color-mix(in srgb, var(--paper-100) 8%, transparent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title="自定义指令"
              aria-label="自定义指令"
            >
              <Icon icon={Send} size="xs" />
            </button>
          </div>

          {/* Custom input field */}
          <AnimatePresence>
            {showCustomInput && (
              <motion.div
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl"
                style={{
                  background: `linear-gradient(180deg, color-mix(in srgb, var(--ink-100) 92%, transparent) 0%, color-mix(in srgb, var(--ink-100) 96%, transparent) 100%)`,
                  border: `1px solid color-mix(in srgb, var(--paper-100) 8%, transparent)`,
                  boxShadow: `0 8px 32px color-mix(in srgb, var(--ink-100) 28%, transparent), 0 4px 12px color-mix(in srgb, var(--ink-100) 16%, transparent)`,
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="输入自定义AI指令..."
                  disabled={isProcessing}
                  className="flex-1 bg-transparent border-none outline-none text-xs px-2 py-1 min-w-[200px]"
                  style={{
                    color: 'var(--paper-85)',
                    caretColor: 'var(--paper-85)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      executeCustomPrompt()
                    }
                  }}
                />
                <button
                  onClick={executeCustomPrompt}
                  disabled={isProcessing || !customInput.trim()}
                  className="p-1.5 rounded-lg transition-colors duration-150"
                  style={{
                    color:
                      isProcessing || !customInput.trim()
                        ? 'var(--paper-30)'
                        : 'var(--color-outline)',
                    opacity:
                      isProcessing || !customInput.trim() ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isProcessing && customInput.trim()) {
                      e.currentTarget.style.backgroundColor =
                        'color-mix(in srgb, var(--paper-100) 8%, transparent)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  title="执行指令 (Enter)"
                  aria-label="执行指令"
                >
                  <Icon icon={Send} size="xs" />
                </button>
                <button
                  onClick={() => {
                    setShowCustomInput(false)
                    setCustomInput('')
                  }}
                  className="p-1.5 rounded-lg transition-colors duration-150"
                  style={{ color: 'var(--paper-50)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      'color-mix(in srgb, var(--paper-100) 8%, transparent)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  title="关闭 (Esc)"
                  aria-label="关闭"
                >
                  <Icon icon={X} size="xs" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
