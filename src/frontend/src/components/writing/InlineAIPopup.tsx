/**
 * InlineAIPopup - Floating popup for inline AI directive results
 *
 * Renders near the cursor position when an @AI directive is executed.
 * Shows: loading state -> streaming result -> accept/reject buttons.
 * Tab = accept, Escape = reject, Ctrl+R = regenerate.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SCALE_IN } from '@/components/shared/AnimationConfig'
import { aiApi } from '@/api/writing'
import { consumeStream } from '@/api/chat'
import { useWritingStore } from '@/store'
import {
  INLINE_AI_EXECUTE_EVENT,
  type InlineAIExecuteDetail,
} from './extensions/InlineAIExtension'
import type { Editor } from '@tiptap/react'

interface InlineAIPopupProps {
  editor: Editor | null
}

type PopupPhase = 'idle' | 'loading' | 'streaming' | 'result' | 'error'

interface PopupState {
  phase: PopupPhase
  prompt: string
  result: string
  streamText: string
  errorMessage: string
  from: number
  to: number
  coords: { top: number; left: number } | null
}

const INITIAL_STATE: PopupState = {
  phase: 'idle',
  prompt: '',
  result: '',
  streamText: '',
  errorMessage: '',
  from: 0,
  to: 0,
  coords: null,
}

export function InlineAIPopup({ editor }: InlineAIPopupProps) {
  const [state, setState] = useState<PopupState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  /** Calculate popup coordinates from editor position */
  const getCoords = useCallback(
    (pos: number): { top: number; left: number } | null => {
      if (!editor?.view) return null
      try {
        const coords = editor.view.coordsAtPos(pos)
        const editorDom = editor.view.dom
        const editorRect = editorDom.getBoundingClientRect()
        const scrollContainer =
          editorDom.closest('.tiptap')?.parentElement || editorDom.parentElement

        if (!scrollContainer) return null

        const scrollTop = scrollContainer.scrollTop
        const scrollLeft = scrollContainer.scrollLeft

        return {
          top: coords.bottom - editorRect.top + scrollTop + 8,
          left: coords.left - editorRect.left + scrollLeft,
        }
      } catch {
        return null
      }
    },
    [editor]
  )

  /** Execute the AI directive */
  const executeDirective = useCallback(
    async (detail: InlineAIExecuteDetail) => {
      const { prompt, from, to } = detail
      if (!prompt.trim()) return

      const coords = getCoords(from)

      setState({
        phase: 'loading',
        prompt,
        result: '',
        streamText: '',
        errorMessage: '',
        from,
        to,
        coords,
      })

      const chapterId =
        useWritingStore.getState().currentChapterId ?? undefined
      const ratio = useWritingStore.getState().humanAIRatio

      try {
        // Use 'continue' as the default operation for inline directives
        const res = await aiApi.continue(prompt, chapterId, ratio)

        abortRef.current = new AbortController()

        setState((prev) => ({ ...prev, phase: 'streaming' }))

        const result = await consumeStream(res.stream, {
          onChunk: (text) => {
            setState((prev) => ({ ...prev, streamText: text }))
          },
          onDone: () => {
            // Will be set after consumeStream returns
          },
        })

        setState((prev) => ({
          ...prev,
          phase: 'result',
          result: result,
          streamText: result,
        }))
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'AI生成失败，请重试'
        setState((prev) => ({
          ...prev,
          phase: 'error',
          errorMessage: msg,
        }))
      }
    },
    [editor, getCoords]
  )

  /** Accept the result: replace the @AI line with the generated text */
  const accept = useCallback(() => {
    if (!editor || !state.result) return

    const { from, to, result } = state

    // Replace the @AI line with the result
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        // Delete the @AI line
        tr.delete(from, to)
        // Insert the result at the same position
        tr.insertText(result, from)
        return true
      })
      .run()

    setState(INITIAL_STATE)
  }, [editor, state])

  /** Reject: remove the @AI line */
  const reject = useCallback(() => {
    if (!editor) return

    const { from, to } = state

    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.delete(from, to)
        return true
      })
      .run()

    setState(INITIAL_STATE)
  }, [editor, state])

  /** Regenerate: re-execute the directive */
  const regenerate = useCallback(() => {
    if (!state.prompt) return
    executeDirective({ prompt: state.prompt, from: state.from, to: state.to })
  }, [state.prompt, state.from, state.to, executeDirective])

  /** Listen for the custom event dispatched by the extension */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<InlineAIExecuteDetail>).detail
      executeDirective(detail)
    }

    document.addEventListener(INLINE_AI_EXECUTE_EVENT, handler)
    return () => document.removeEventListener(INLINE_AI_EXECUTE_EVENT, handler)
  }, [executeDirective])

  /** Keyboard shortcuts when popup is active */
  useEffect(() => {
    if (state.phase === 'idle') return

    const handler = (e: KeyboardEvent) => {
      // Tab = accept
      if (e.key === 'Tab' && state.phase === 'result') {
        e.preventDefault()
        accept()
        return
      }

      // Escape = reject
      if (e.key === 'Escape') {
        e.preventDefault()
        reject()
        return
      }

      // Ctrl+R = regenerate
      if (e.key === 'r' && (e.ctrlKey || e.metaKey) && state.phase !== 'loading' && state.phase !== 'streaming') {
        e.preventDefault()
        regenerate()
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [state.phase, accept, reject, regenerate])

  // Don't render in idle state
  if (state.phase === 'idle' || !state.coords) return null

  const displayText =
    state.phase === 'streaming' || state.phase === 'result'
      ? state.streamText
      : ''

  return (
    <AnimatePresence>
      <motion.div
        ref={popupRef}
        variants={SCALE_IN}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed z-[100] max-w-lg min-w-[280px]"
        style={{
          top: state.coords.top,
          left: Math.min(state.coords.left, window.innerWidth - 420),
        }}
      >
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--ink-100) 95%, transparent) 0%, color-mix(in srgb, var(--ink-100) 98%, transparent) 100%)',
            border:
              '1px solid color-mix(in srgb, var(--paper-100) 10%, transparent)',
            boxShadow:
              '0 8px 32px color-mix(in srgb, var(--ink-100) 30%, transparent), 0 2px 8px color-mix(in srgb, var(--ink-100) 15%, transparent)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{
              borderBottom:
                '1px solid color-mix(in srgb, var(--paper-100) 8%, transparent)',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor:
                  state.phase === 'error'
                    ? 'var(--color-faction)'
                    : state.phase === 'result'
                      ? 'var(--color-location)'
                      : 'var(--color-outline)',
                animation:
                  state.phase === 'loading' || state.phase === 'streaming'
                    ? 'pulse 1.5s ease-in-out infinite'
                    : 'none',
              }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--paper-70)' }}
            >
              {state.phase === 'loading'
                ? 'AI 思考中...'
                : state.phase === 'streaming'
                  ? 'AI 生成中...'
                  : state.phase === 'result'
                    ? '生成完成'
                    : '生成失败'}
            </span>
            <span
              className="text-xs ml-auto"
              style={{ color: 'var(--paper-50)', fontFamily: 'monospace' }}
            >
              {state.prompt.length > 20
                ? state.prompt.slice(0, 20) + '...'
                : state.prompt}
            </span>
          </div>

          {/* Content area */}
          <div className="px-4 py-3 min-h-[60px] max-h-[240px] overflow-y-auto">
            {state.phase === 'loading' && (
              <div className="flex items-center gap-3">
                <InkDropLoader />
                <span
                  className="text-sm"
                  style={{ color: 'var(--paper-60)' }}
                >
                  正在构思...
                </span>
              </div>
            )}

            {(state.phase === 'streaming' || state.phase === 'result') && (
              <div
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--paper-85)' }}
              >
                {displayText}
                {state.phase === 'streaming' && (
                  <span
                    className="inline-block w-0.5 h-4 ml-0.5 align-middle"
                    style={{
                      backgroundColor: 'var(--color-outline)',
                      animation: 'blink 1s step-end infinite',
                    }}
                  />
                )}
              </div>
            )}

            {state.phase === 'error' && (
              <div className="flex items-center gap-2">
                <span
                  className="text-sm"
                  style={{ color: 'var(--color-faction)' }}
                >
                  {state.errorMessage}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {(state.phase === 'result' || state.phase === 'error') && (
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{
                borderTop:
                  '1px solid color-mix(in srgb, var(--paper-100) 8%, transparent)',
              }}
            >
              {state.phase === 'result' && (
                <>
                  <ActionButton
                    label="接受"
                    shortcut="Tab"
                    variant="primary"
                    onClick={accept}
                  />
                  <ActionButton
                    label="重新生成"
                    shortcut="Ctrl+R"
                    variant="secondary"
                    onClick={regenerate}
                  />
                </>
              )}
              {state.phase === 'error' && (
                <ActionButton
                  label="重试"
                  shortcut="Ctrl+R"
                  variant="primary"
                  onClick={regenerate}
                />
              )}
              <ActionButton
                label="取消"
                shortcut="Esc"
                variant="ghost"
                onClick={reject}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ============================================================
   Sub-components
   ============================================================ */

interface ActionButtonProps {
  label: string
  shortcut: string
  variant: 'primary' | 'secondary' | 'ghost'
  onClick: () => void
}

function ActionButton({ label, shortcut, variant, onClick }: ActionButtonProps) {
  const styles: Record<
    string,
    { bg: string; border: string; text: string; hoverBg: string }
  > = {
    primary: {
      bg: 'var(--color-outline)',
      border: 'transparent',
      text: 'var(--paper-100)',
      hoverBg: 'color-mix(in srgb, var(--color-outline) 85%, black)',
    },
    secondary: {
      bg: 'transparent',
      border: 'color-mix(in srgb, var(--paper-100) 15%, transparent)',
      text: 'var(--paper-70)',
      hoverBg: 'color-mix(in srgb, var(--paper-100) 8%, transparent)',
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      text: 'var(--paper-50)',
      hoverBg: 'color-mix(in srgb, var(--paper-100) 5%, transparent)',
    },
  }

  const s = styles[variant]

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
      style={{
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = s.hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = s.bg
      }}
    >
      {label}
      <kbd
        className="text-[10px] px-1 py-0.5 rounded"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--paper-100) 8%, transparent)',
          color: 'var(--paper-50)',
          fontFamily: 'monospace',
        }}
      >
        {shortcut}
      </kbd>
    </button>
  )
}

/** Ink-drop loading animation (Chinese ink-wash style) */
function InkDropLoader() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--color-outline)' }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
