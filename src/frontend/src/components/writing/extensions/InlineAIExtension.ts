/**
 * InlineAIExtension - Tiptap extension for @AI inline directive detection
 *
 * Detects lines starting with "@AI " or "/ai " and provides:
 * - Visual decorations (dimmed prefix + highlighted prompt)
 * - Enter key dispatches a custom event for the InlineAIPopup to handle
 * - Escape key removes the @AI line entirely
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const InlineAIPluginKey = new PluginKey<InlineAIState>('inlineAI')

export interface InlineAIState {
  active: boolean
  promptText: string
  from: number // document position of @AI prefix start
  to: number   // document position of end of prompt line
}

/** Prefix patterns to detect (case-insensitive) */
const AI_PREFIXES = ['@AI ', '@ai ', '/AI ', '/ai ']

/** Custom event name dispatched when user presses Enter on an active @AI line */
export const INLINE_AI_EXECUTE_EVENT = 'inline-ai-execute'

/** Custom event name dispatched when @AI state changes */
export const INLINE_AI_STATE_CHANGE_EVENT = 'inline-ai-state-change'

export interface InlineAIExecuteDetail {
  prompt: string
  from: number
  to: number
}

/**
 * Find the paragraph boundaries around a document position.
 */
function getParagraphRange(
  doc: import('prosemirror-model').Node,
  pos: number
): { start: number; end: number; text: string } | null {
  let result: { start: number; end: number; text: string } | null = null

  doc.descendants((node, nodePos) => {
    if (node.isBlock && node.isTextblock) {
      const nodeEnd = nodePos + node.nodeSize
      if (nodePos <= pos && pos <= nodeEnd) {
        result = {
          start: nodePos,
          end: nodeEnd,
          text: node.textContent || '',
        }
        return false
      }
    }
    return true
  })

  return result
}

/**
 * Check if text starts with an AI prefix and return the prefix length.
 */
function matchAIPrefix(text: string): number {
  for (const prefix of AI_PREFIXES) {
    if (text.startsWith(prefix)) {
      return prefix.length
    }
  }
  return 0
}

export const InlineAIExtension = Extension.create({
  name: 'inlineAI',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: InlineAIPluginKey,

        state: {
          init(): InlineAIState {
            return { active: false, promptText: '', from: 0, to: 0 }
          },

          apply(tr, value): InlineAIState {
            // If the doc changed or selection changed, recompute state
            const meta = tr.getMeta(InlineAIPluginKey)
            if (meta !== undefined) {
              return meta as InlineAIState
            }

            // Auto-clear when the range no longer has the @AI prefix
            if (tr.docChanged && value.active) {
              try {
                const paragraph = getParagraphRange(tr.doc, value.from)
                if (!paragraph) {
                  return { active: false, promptText: '', from: 0, to: 0 }
                }
                const prefixLen = matchAIPrefix(paragraph.text)
                if (prefixLen === 0) {
                  return { active: false, promptText: '', from: 0, to: 0 }
                }
              } catch {
                return { active: false, promptText: '', from: 0, to: 0 }
              }
            }

            return value
          },
        },

        props: {
          decorations(state) {
            const pluginState = InlineAIPluginKey.getState(state)
            if (!pluginState || !pluginState.active) {
              return DecorationSet.empty
            }

            const { from } = pluginState
            const decorations: Decoration[] = []

            // Decoration for the @AI prefix (dimmed)
            const paragraph = getParagraphRange(state.doc, from)
            if (!paragraph) return DecorationSet.empty

            const prefixLen = matchAIPrefix(paragraph.text)
            if (prefixLen === 0) return DecorationSet.empty

            // Dim the prefix text
            decorations.push(
              Decoration.inline(paragraph.start, paragraph.start + prefixLen, {
                style:
                  'opacity: 0.4; font-family: monospace; font-size: 0.9em; letter-spacing: 0.05em;',
                class: 'inline-ai-prefix',
              })
            )

            // Highlight the prompt text (after prefix)
            if (paragraph.text.length > prefixLen) {
              decorations.push(
                Decoration.inline(
                  paragraph.start + prefixLen,
                  paragraph.end,
                  {
                    style:
                      'background: color-mix(in srgb, var(--color-outline, #7088a8) 15%, transparent); border-radius: 3px; padding: 1px 0;',
                    class: 'inline-ai-prompt',
                  }
                )
              )
            }

            // Add a subtle underline to the whole line
            decorations.push(
              Decoration.inline(paragraph.start, paragraph.end, {
                class: 'inline-ai-line',
              })
            )

            return DecorationSet.create(state.doc, decorations)
          },

          handleKeyDown(view, event) {
            const pluginState = InlineAIPluginKey.getState(view.state)
            if (!pluginState || !pluginState.active) return false

            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()

              // Dispatch custom event for the InlineAIPopup
              const detail: InlineAIExecuteDetail = {
                prompt: pluginState.promptText,
                from: pluginState.from,
                to: pluginState.to,
              }
              document.dispatchEvent(
                new CustomEvent(INLINE_AI_EXECUTE_EVENT, { detail })
              )

              return true
            }

            if (event.key === 'Escape') {
              event.preventDefault()

              // Remove the @AI line entirely
              const paragraph = getParagraphRange(view.state.doc, pluginState.from)
              if (paragraph) {
                const tr = view.state.tr.delete(paragraph.start, paragraph.end)
                view.dispatch(tr)
              }

              // Clear plugin state
              view.dispatch(
                view.state.tr.setMeta(InlineAIPluginKey, {
                  active: false,
                  promptText: '',
                  from: 0,
                  to: 0,
                })
              )

              return true
            }

            return false
          },
        },

        appendTransaction(_transactions, oldState, newState) {
          // Track cursor position to detect @AI lines
          const { from } = newState.selection

          // Get the paragraph at cursor
          const paragraph = getParagraphRange(newState.doc, from)
          if (!paragraph) {
            const current = InlineAIPluginKey.getState(oldState)
            if (current?.active) {
              return newState.tr.setMeta(InlineAIPluginKey, {
                active: false,
                promptText: '',
                from: 0,
                to: 0,
              })
            }
            return null
          }

          const prefixLen = matchAIPrefix(paragraph.text)
          const current = InlineAIPluginKey.getState(newState)

          if (prefixLen > 0) {
            const promptText = paragraph.text.slice(prefixLen)
            const newStateObj: InlineAIState = {
              active: true,
              promptText,
              from: paragraph.start,
              to: paragraph.end,
            }

            // Only update if state actually changed
            if (
              !current ||
              !current.active ||
              current.promptText !== promptText ||
              current.from !== paragraph.start
            ) {
              return newState.tr.setMeta(InlineAIPluginKey, newStateObj)
            }
          } else if (current?.active) {
            return newState.tr.setMeta(InlineAIPluginKey, {
              active: false,
              promptText: '',
              from: 0,
              to: 0,
            })
          }

          return null
        },
      }),
    ]
  },
})
