/**
 * StyleCheckExtension - Tiptap extension for real-time style checking
 *
 * Highlights style issues in Chinese text using ProseMirror decorations:
 * - Weak verbs (是/有/在/会/能/要/被): red wavy underline
 * - Adverbs (很/非常/十分/极其/特别/格外/异常): orange wavy underline
 * - Passive voice (被/叫/让/给 + verb): purple wavy underline
 *
 * Uses client-side regex pattern matching (NOT API calls) for real-time checking.
 * Debounced at 2 seconds after typing stops to avoid blocking UI.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorView } from '@tiptap/pm/view'

export const StyleCheckPluginKey = new PluginKey<StyleCheckState>('styleCheck')

// ============================================
// Types
// ============================================

export type StyleIssueType = 'weak_verb' | 'adverb' | 'passive'

export interface StyleIssue {
  type: StyleIssueType
  from: number
  to: number
  suggestion: string
}

export interface StyleCheckState {
  issues: StyleIssue[]
  decorations: DecorationSet
  enabled: boolean
}

export interface StyleCheckOptions {
  enabled: boolean
  debounceMs: number
}

// ============================================
// Pattern Definitions (Chinese text patterns)
// ============================================

/** Weak verbs that indicate vague or passive writing */
const WEAK_VERB_PATTERN = /[是有了在会能要被]/g

/** Adverbs that often weaken prose */
const ADVERB_PATTERN = /[很非常十分极其特别格外异常]/g

/** Passive voice patterns: 被/叫/让/给 followed by a Chinese character */
const PASSIVE_PATTERN = /[被叫让给](?=[一-鿿])/g

// ============================================
// Issue Detection
// ============================================

/**
 * Scan text for style issues within a given offset range.
 * Returns array of StyleIssue with absolute document positions.
 */
function detectStyleIssues(text: string, offset: number): StyleIssue[] {
  const issues: StyleIssue[] = []

  // Detect weak verbs
  let match: RegExpExecArray | null

  WEAK_VERB_PATTERN.lastIndex = 0
  while ((match = WEAK_VERB_PATTERN.exec(text)) !== null) {
    issues.push({
      type: 'weak_verb',
      from: offset + match.index,
      to: offset + match.index + match[0].length,
      suggestion: '考虑使用更具体的动词替代',
    })
  }

  // Detect adverbs
  ADVERB_PATTERN.lastIndex = 0
  while ((match = ADVERB_PATTERN.exec(text)) !== null) {
    issues.push({
      type: 'adverb',
      from: offset + match.index,
      to: offset + match.index + match[0].length,
      suggestion: '尝试用更生动的描写替代程度副词',
    })
  }

  // Detect passive voice
  PASSIVE_PATTERN.lastIndex = 0
  while ((match = PASSIVE_PATTERN.exec(text)) !== null) {
    issues.push({
      type: 'passive',
      from: offset + match.index,
      to: offset + match.index + match[0].length,
      suggestion: '考虑改为主动语态增强表达力',
    })
  }

  return issues
}

// ============================================
// Decoration Creation
// ============================================

/** CSS class names for each issue type */
const ISSUE_CLASS_MAP: Record<StyleIssueType, string> = {
  weak_verb: 'style-check-weak-verb',
  adverb: 'style-check-adverb',
  passive: 'style-check-passive',
}

/** Tooltip text for each issue type */
const ISSUE_LABEL_MAP: Record<StyleIssueType, string> = {
  weak_verb: '弱动词',
  adverb: '程度副词',
  passive: '被动语态',
}

/**
 * Create ProseMirror InlineDecorations from style issues.
 */
function createDecorations(issues: StyleIssue[]): Decoration[] {
  return issues.map((issue) => {
    const className = ISSUE_CLASS_MAP[issue.type]
    const label = ISSUE_LABEL_MAP[issue.type]
    return Decoration.inline(issue.from, issue.to, {
      class: className,
      'data-style-issue': issue.type,
      'data-style-suggestion': issue.suggestion,
      'data-style-label': label,
    })
  })
}

// ============================================
// Document Scanning
// ============================================

/**
 * Scan entire document for style issues.
 * Uses requestIdleCallback if available to avoid blocking UI.
 */
function scanDocument(
  doc: import('prosemirror-model').Node
): { issues: StyleIssue[]; decorations: Decoration[] } {
  const allIssues: StyleIssue[] = []
  let textOffset = 0

  doc.descendants((node) => {
    if (node.isText && node.text) {
      const issues = detectStyleIssues(node.text, textOffset)
      allIssues.push(...issues)
    }
    if (node.isText) {
      textOffset += node.textContent?.length || 0
    }
    return true
  })

  // Note: The offset calculation above is simplified.
  // For inline decorations, we need document positions, not text offsets.
  // We'll recalculate using proper document positions.
  const properIssues: StyleIssue[] = []

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      let match: RegExpExecArray | null

      // Weak verbs
      WEAK_VERB_PATTERN.lastIndex = 0
      while ((match = WEAK_VERB_PATTERN.exec(node.text)) !== null) {
        properIssues.push({
          type: 'weak_verb',
          from: pos + match.index,
          to: pos + match.index + match[0].length,
          suggestion: '考虑使用更具体的动词替代',
        })
      }

      // Adverbs
      ADVERB_PATTERN.lastIndex = 0
      while ((match = ADVERB_PATTERN.exec(node.text)) !== null) {
        properIssues.push({
          type: 'adverb',
          from: pos + match.index,
          to: pos + match.index + match[0].length,
          suggestion: '尝试用更生动的描写替代程度副词',
        })
      }

      // Passive voice
      PASSIVE_PATTERN.lastIndex = 0
      while ((match = PASSIVE_PATTERN.exec(node.text)) !== null) {
        properIssues.push({
          type: 'passive',
          from: pos + match.index,
          to: pos + match.index + match[0].length,
          suggestion: '考虑改为主动语态增强表达力',
        })
      }
    }
    return true
  })

  const decorations = createDecorations(properIssues)
  return { issues: properIssues, decorations }
}

// ============================================
// Debounce Utility
// ============================================

function createDebouncedScan(view: EditorView, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      // Use requestIdleCallback if available for non-blocking execution
      const runScan = () => {
        const { issues, decorations } = scanDocument(view.state.doc)
        const decoSet = DecorationSet.create(view.state.doc, decorations)

        view.dispatch(
          view.state.tr.setMeta(StyleCheckPluginKey, {
            issues,
            decorations: decoSet,
          })
        )
      }

      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(runScan, { timeout: 500 })
      } else {
        runScan()
      }
    }, delay)
  }
}

// ============================================
// Extension Definition
// ============================================

export const StyleCheckExtension = Extension.create<StyleCheckOptions>({
  name: 'styleCheck',

  addOptions() {
    return {
      enabled: true,
      debounceMs: 2000,
    }
  },

  addStorage() {
    return {
      issues: [] as StyleIssue[],
    }
  },

  addProseMirrorPlugins() {
    const { enabled, debounceMs } = this.options

    if (!enabled) {
      return []
    }

    return [
      new Plugin<StyleCheckState>({
        key: StyleCheckPluginKey,

        state: {
          init() {
            return {
              issues: [],
              decorations: DecorationSet.empty,
              enabled,
            }
          },

          apply(tr, oldState) {
            const meta = tr.getMeta(StyleCheckPluginKey)

            if (meta) {
              return {
                issues: meta.issues || oldState.issues,
                decorations: meta.decorations || oldState.decorations,
                enabled,
              }
            }

            // Map decorations through document changes
            if (tr.docChanged) {
              return {
                ...oldState,
                decorations: oldState.decorations.map(tr.mapping, tr.doc),
              }
            }

            return oldState
          },
        },

        view() {
          let debouncedScan: (() => void) | null = null

          return {
            update(view, prevState) {
              // Only scan when document actually changes
              if (!view.state.doc.eq(prevState.doc)) {
                if (!debouncedScan) {
                  debouncedScan = createDebouncedScan(view, debounceMs)
                }
                debouncedScan()
              }
            },

            destroy() {
              debouncedScan = null
            },
          }
        },

        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty
          },

          // Add tooltip on hover
          handleDOMEvents: {
            mouseover(_view, event) {
              const target = event.target as HTMLElement
              const issueType = target.getAttribute('data-style-issue')
              const suggestion = target.getAttribute('data-style-suggestion')
              const label = target.getAttribute('data-style-label')

              if (issueType && suggestion && label) {
                // Create or update tooltip
                let tooltip = document.getElementById('style-check-tooltip')
                if (!tooltip) {
                  tooltip = document.createElement('div')
                  tooltip.id = 'style-check-tooltip'
                  tooltip.style.cssText = `
                    position: fixed;
                    z-index: 10000;
                    padding: 8px 12px;
                    background: var(--ink-90);
                    color: var(--paper-100);
                    border-radius: 6px;
                    font-size: 13px;
                    line-height: 1.4;
                    pointer-events: none;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    max-width: 250px;
                    transition: opacity 0.15s ease;
                  `
                  document.body.appendChild(tooltip)
                }

                const mouseEvent = event as MouseEvent
                tooltip.textContent = `${label}：${suggestion}`
                tooltip.style.left = `${mouseEvent.clientX + 12}px`
                tooltip.style.top = `${mouseEvent.clientY - 30}px`
                tooltip.style.opacity = '1'
              }

              return false
            },

            mouseout(_view, event) {
              const target = event.target as HTMLElement
              if (target.getAttribute('data-style-issue')) {
                const tooltip = document.getElementById('style-check-tooltip')
                if (tooltip) {
                  tooltip.style.opacity = '0'
                }
              }
              return false
            },
          },
        },
      }),
    ]
  },
})

// ============================================
// Selectors / Public API
// ============================================

/**
 * Get all style issues from the current editor state.
 */
export function getStyleIssues(state: import('@tiptap/pm/state').EditorState): StyleIssue[] {
  return StyleCheckPluginKey.getState(state)?.issues ?? []
}

/**
 * Get style issue counts by type.
 */
export function getStyleIssueCounts(state: import('@tiptap/pm/state').EditorState): Record<StyleIssueType, number> {
  const issues = getStyleIssues(state)
  return {
    weak_verb: issues.filter((i) => i.type === 'weak_verb').length,
    adverb: issues.filter((i) => i.type === 'adverb').length,
    passive: issues.filter((i) => i.type === 'passive').length,
  }
}

/**
 * Clear all style check tooltips from the DOM.
 */
export function cleanupStyleCheckTooltips(): void {
  const tooltip = document.getElementById('style-check-tooltip')
  if (tooltip) {
    tooltip.remove()
  }
}
