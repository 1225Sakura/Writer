/**
 * GhostTextExtension - Tiptap extension for inline AI ghost text suggestions
 *
 * Monitors user typing and, after a configurable debounce period (default 500ms),
 * requests an AI completion suggestion displayed as grey text at the cursor position.
 *
 * - Tab accepts the suggestion (inserts text)
 * - Esc dismisses the suggestion
 * - Any other key continues typing normally (suggestion clears)
 *
 * Uses @tiptap/suggestion for the core suggestion plumbing and decoration rendering.
 */

import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { aiApi } from '@/api/writing'
import { useWritingStore } from '@/store'

/* ============================================================
   TYPES
   ============================================================ */

export interface GhostTextItem {
  text: string
}

/* ============================================================
   CONSTANTS
   ============================================================ */

/** Default debounce before triggering AI suggestion (ms) */
const DEFAULT_DEBOUNCE_MS = 500

/** Minimum number of characters before triggering suggestion */
const MIN_CONTEXT_LENGTH = 10

/** Maximum context to send to the AI (characters) */
const MAX_CONTEXT_LENGTH = 2000

/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Get recent text context before the cursor for AI completion.
 * Returns up to MAX_CONTEXT_LENGTH characters from the document.
 */
function getContextBeforeCursor(editor: import('@tiptap/core').Editor): string {
  const { from } = editor.state.selection
  const docText = editor.state.doc.textBetween(
    Math.max(0, from - MAX_CONTEXT_LENGTH),
    from,
    '\n'
  )
  return docText
}

/* ============================================================
   GHOST TEXT STATE (module-level singleton per extension instance)
   ============================================================ */

let pendingAbort: AbortController | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/* ============================================================
   EXTENSION
   ============================================================ */

export const GhostTextExtension = Extension.create({
  name: 'ghostText',

  addOptions() {
    return {
      debounceMs: DEFAULT_DEBOUNCE_MS,
    }
  },

  addProseMirrorPlugins() {
    const self = this

    return [
      Suggestion({
        editor: self.editor,
        char: '\0', // We trigger manually, not by character
        pluginKey: undefined,
        allowSpaces: true,
        allowedPrefixes: null,
        startOfLine: false,

        items: async ({ editor }) => {
          const context = getContextBeforeCursor(editor)
          if (context.trim().length < MIN_CONTEXT_LENGTH) {
            return []
          }

          // Cancel any previous pending request
          if (pendingAbort) {
            pendingAbort.abort()
          }
          pendingAbort = new AbortController()

          try {
            const chapterId =
              useWritingStore.getState().currentChapterId ?? undefined
            const ratio = useWritingStore.getState().humanAIRatio

            const res = await aiApi.continue(context, chapterId, ratio)
            const reader = res.stream.getReader()
            let fullText = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = new TextDecoder().decode(value)

              // Parse SSE-style chunks: lines starting with "data: "
              for (const line of chunk.split('\n')) {
                if (line.startsWith('data: ')) {
                  const payload = line.slice(6).trim()
                  if (payload === '[DONE]') break
                  try {
                    const parsed = JSON.parse(payload)
                    if (parsed.text) fullText += parsed.text
                    else if (parsed.content) fullText += parsed.content
                    else if (typeof parsed === 'string') fullText += parsed
                  } catch {
                    // Plain text chunk
                    fullText += payload
                  }
                }
              }
            }

            // Trim leading context overlap: remove prefix that matches the user's existing text
            const trimmed = trimOverlap(context, fullText)

            if (trimmed.trim().length > 0) {
              return [{ text: trimmed }]
            }
            return []
          } catch {
            return []
          }
        },

        command: ({ editor, range, props }: { editor: import('@tiptap/core').Editor; range: import('@tiptap/core').Range; props: GhostTextItem }) => {
          // Insert the ghost text at the suggestion range
          editor
            .chain()
            .focus()
            .insertContentAt(range, props.text)
            .run()
        },

        render: () => {
          return {
            onStart: (props: SuggestionProps<GhostTextItem>) => {
              if (!props.items.length) return
              renderGhostDecoration(props)
            },

            onUpdate: (props: SuggestionProps<GhostTextItem>) => {
              if (!props.items.length) {
                removeGhostDecoration()
                return
              }
              renderGhostDecoration(props)
            },

            onExit: () => {
              clearDebounce()
              removeGhostDecoration()
            },

            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Tab') {
                // Accept: let Suggestion call command with the first item
                props.event.preventDefault()
                return false // Return false so Suggestion handles it
              }

              if (props.event.key === 'Escape') {
                // Dismiss
                clearDebounce()
                removeGhostDecoration()
                return true
              }

              // Any other key: clear ghost and let typing continue
              clearDebounce()
              removeGhostDecoration()
              return false
            },
          }
        },
      }),
    ]
  },
})

/* ============================================================
   DECORATION HELPERS
   ============================================================ */

/** Render ghost text as an inline decoration via ProseMirror */
function renderGhostDecoration(props: SuggestionProps<GhostTextItem>) {
  const { items, decorationNode } = props
  if (!items.length) return

  const ghostText = items[0].text
  const decorationEl = decorationNode as HTMLElement | null

  if (decorationEl) {
    decorationEl.textContent = ghostText
    decorationEl.style.cssText = `
      opacity: 0.5;
      color: var(--text-primary);
      pointer-events: none;
      font-style: italic;
    `
    decorationEl.classList.add('ghost-text-decoration')
  }
}

function removeGhostDecoration() {
  const decorations = document.querySelectorAll('.ghost-text-decoration')
  decorations.forEach((el) => {
    el.textContent = ''
    el.classList.remove('ghost-text-decoration')
  })
}

function clearDebounce() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (pendingAbort) {
    pendingAbort.abort()
    pendingAbort = null
  }
}

/* ============================================================
   OVERLAP TRIMMING
   ============================================================ */

/**
 * Trim leading overlap between context (what user typed) and the AI response.
 * The AI often repeats the last few words of the context before continuing.
 */
function trimOverlap(context: string, response: string): string {
  if (!response) return ''
  if (!context) return response

  // Try to find the longest suffix of context that is a prefix of response
  const maxCheck = Math.min(context.length, response.length, 100)
  for (let len = maxCheck; len > 0; len--) {
    const suffix = context.slice(-len)
    if (response.startsWith(suffix)) {
      return response.slice(len)
    }
  }
  return response
}
