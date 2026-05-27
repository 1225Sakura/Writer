/**
 * EditorToolbar - Floating formatting toolbar for the editor
 *
 * Appears on text selection with format, alignment, and quick-format buttons.
 * Sub-components are split into:
 *   - StyleSelector.tsx   — Paragraph style dropdown
 *   - ToolbarButtons.tsx  — Button definitions, dividers, and rendering
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getFormatButtons,
  getAlignButtons,
  getQuickFormatButtons,
  renderDivider,
  renderButton,
} from './ToolbarButtons'
import { StyleSelector } from './StyleSelector'
import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [visible, setVisible] = useState(false)
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      const hasSelection = from !== to
      const isEmpty = editor.isEmpty
      setVisible(hasSelection && !isEmpty)
      setStyleMenuOpen(false)
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.on('focus', handleSelectionUpdate)
    editor.on('blur', () => {
      setTimeout(() => {
        setVisible(false)
        setStyleMenuOpen(false)
      }, 200)
    })

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      editor.off('focus', handleSelectionUpdate)
    }
  }, [editor])

  if (!editor) return null

  const formatButtons = getFormatButtons(editor)
  const alignButtons = getAlignButtons(editor)
  const quickFormatButtons = getQuickFormatButtons(editor)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 px-2.5 py-1.5 rounded-xl"
          style={{
            background: `linear-gradient(180deg, color-mix(in srgb, var(--ink-100) 92%, transparent) 0%, color-mix(in srgb, var(--ink-100) 96%, transparent) 100%)`,
            border: `1px solid color-mix(in srgb, var(--paper-100) 8%, transparent)`,
            boxShadow: `0 8px 32px color-mix(in srgb, var(--ink-100) 28%, transparent), 0 4px 12px color-mix(in srgb, var(--ink-100) 16%, transparent), inset 0 1px 0 color-mix(in srgb, var(--paper-100) 6%, transparent)`,
          }}
          role="toolbar"
          aria-label="文本编辑工具栏"
          aria-controls="editor-content"
        >
          {/* Paragraph style selector */}
          <StyleSelector
            editor={editor}
            isOpen={styleMenuOpen}
            onToggle={() => setStyleMenuOpen(!styleMenuOpen)}
            onClose={() => setStyleMenuOpen(false)}
          />

          {/* Gradient divider */}
          {renderDivider(0)}

          {/* Format buttons */}
          {formatButtons.map((btn, i) => renderButton(btn, i, 0))}

          {/* Gradient divider */}
          {renderDivider(1)}

          {/* Alignment buttons */}
          {alignButtons.map((btn, i) => renderButton(btn, i, 1))}

          {/* Gradient divider */}
          {renderDivider(2)}

          {/* Quick format buttons */}
          {quickFormatButtons.map((btn, i) => renderButton(btn, i, 2))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
