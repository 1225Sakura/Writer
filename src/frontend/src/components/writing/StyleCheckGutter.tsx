/**
 * StyleCheckGutter - Side gutter indicator for style issues
 *
 * Renders in the left margin of the editor.
 * Shows small colored dots/badges for issues in view.
 * Click on a dot scrolls to that issue.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import type { EditorState } from '@tiptap/pm/state'
import { StyleCheckPluginKey, type StyleIssue, type StyleIssueType } from './extensions/StyleCheckExtension'

// ============================================
// Types
// ============================================

interface StyleCheckGutterProps {
  editor: Editor | null
}

interface IssueGroup {
  type: StyleIssueType
  count: number
  issues: StyleIssue[]
}

// ============================================
// Constants
// ============================================

/** Color definitions for each issue type */
const ISSUE_COLORS: Record<StyleIssueType, string> = {
  weak_verb: '#dc2626',   // red
  adverb: '#ea580c',      // orange
  passive: '#9333ea',     // purple
}

/** Labels for each issue type */
const ISSUE_LABELS: Record<StyleIssueType, string> = {
  weak_verb: '弱动词',
  adverb: '副词',
  passive: '被动',
}

// ============================================
// Component
// ============================================

export function StyleCheckGutter({ editor }: StyleCheckGutterProps) {
  const [issueGroups, setIssueGroups] = useState<IssueGroup[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const gutterRef = useRef<HTMLDivElement>(null)

  // Subscribe to style check plugin state changes
  const editorState = useEditorState({
    editor,
    selector: ({ editor: editorInstance }) => {
      if (!editorInstance) return []
      const state = editorInstance.state as EditorState
      const pluginState = StyleCheckPluginKey.getState(state)
      return pluginState?.issues ?? []
    },
  })

  // Group issues by type when editor state changes
  useEffect(() => {
    if (!editorState || editorState.length === 0) {
      setIssueGroups([])
      setIsVisible(false)
      return
    }

    const groups: Record<StyleIssueType, IssueGroup> = {
      weak_verb: { type: 'weak_verb', count: 0, issues: [] },
      adverb: { type: 'adverb', count: 0, issues: [] },
      passive: { type: 'passive', count: 0, issues: [] },
    }

    for (const issue of editorState) {
      groups[issue.type].count++
      groups[issue.type].issues.push(issue)
    }

    const activeGroups = Object.values(groups).filter((g) => g.count > 0)
    setIssueGroups(activeGroups)
    setIsVisible(activeGroups.length > 0)
  }, [editorState])

  // Scroll to first issue of given type
  const scrollToIssue = useCallback(
    (type: StyleIssueType) => {
      if (!editor) return

      const issues = editorState?.filter((i) => i.type === type)
      if (!issues || issues.length === 0) return

      // Scroll to the first issue of this type
      const firstIssue = issues[0]
      editor.chain().focus().setTextSelection(firstIssue.from).run()

      // Scroll into view
      const { view } = editor
      const coords = view.coordsAtPos(firstIssue.from)
      if (coords) {
        const editorDom = view.dom
        const scrollContainer = editorDom.closest('.tiptap')?.parentElement || editorDom.parentElement
        if (scrollContainer) {
          const editorRect = editorDom.getBoundingClientRect()
          const targetScroll = coords.top - editorRect.top + scrollContainer.scrollTop - 100
          scrollContainer.scrollTo({ top: targetScroll, behavior: 'smooth' })
        }
      }
    },
    [editor, editorState]
  )

  // Don't render if no issues
  if (!isVisible || issueGroups.length === 0) {
    return null
  }

  const totalIssues = issueGroups.reduce((sum, g) => sum + g.count, 0)

  return (
    <div
      ref={gutterRef}
      className="style-check-gutter"
      style={{
        position: 'absolute',
        left: '-48px',
        top: '120px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        zIndex: 10,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      {/* Total count badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: 'var(--ink-90, #1a1a1a)',
          color: 'var(--paper-100, #f5f5f5)',
          fontSize: '11px',
          fontWeight: 600,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
        title={`共 ${totalIssues} 个风格问题`}
      >
        {totalIssues}
      </div>

      {/* Issue type indicators */}
      {issueGroups.map((group) => (
        <button
          key={group.type}
          onClick={() => scrollToIssue(group.type)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: `${ISSUE_COLORS[group.type]}20`,
            color: ISSUE_COLORS[group.type],
            fontSize: '10px',
            fontWeight: 600,
            transition: 'all 0.15s ease',
            padding: 0,
          }}
          title={`${ISSUE_LABELS[group.type]}: ${group.count}个`}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${ISSUE_COLORS[group.type]}40`
            e.currentTarget.style.transform = 'scale(1.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${ISSUE_COLORS[group.type]}20`
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          {group.count}
        </button>
      ))}
    </div>
  )
}

// ============================================
// Inline Style Tags (injected into document head)
// ============================================

/**
 * Inject CSS styles for style check decorations.
 * Call this once when the editor mounts.
 */
export function injectStyleCheckStyles(): void {
  const styleId = 'style-check-decorations'

  // Avoid duplicate injection
  if (document.getElementById(styleId)) {
    return
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    /* Weak verbs - red wavy underline */
    .style-check-weak-verb {
      text-decoration: underline wavy #dc2626;
      text-decoration-skip-ink: none;
      text-underline-offset: 3px;
      cursor: help;
      transition: background-color 0.15s ease;
    }

    .style-check-weak-verb:hover {
      background-color: #dc262615;
    }

    /* Adverbs - orange wavy underline */
    .style-check-adverb {
      text-decoration: underline wavy #ea580c;
      text-decoration-skip-ink: none;
      text-underline-offset: 3px;
      cursor: help;
      transition: background-color 0.15s ease;
    }

    .style-check-adverb:hover {
      background-color: #ea580c15;
    }

    /* Passive voice - purple wavy underline */
    .style-check-passive {
      text-decoration: underline wavy #9333ea;
      text-decoration-skip-ink: none;
      text-underline-offset: 3px;
      cursor: help;
      transition: background-color 0.15s ease;
    }

    .style-check-passive:hover {
      background-color: #9333ea15;
    }

    /* Tooltip transitions */
    #style-check-tooltip {
      transition: opacity 0.15s ease;
    }

    /* Reduce motion for accessibility */
    @media (prefers-reduced-motion: reduce) {
      .style-check-weak-verb,
      .style-check-adverb,
      .style-check-passive {
        transition: none;
      }

      .style-check-gutter button {
        transition: none;
      }
    }
  `

  document.head.appendChild(style)
}

/**
 * Remove injected style check styles from the DOM.
 */
export function removeStyleCheckStyles(): void {
  const style = document.getElementById('style-check-decorations')
  if (style) {
    style.remove()
  }
}
