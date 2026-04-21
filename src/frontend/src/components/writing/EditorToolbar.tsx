import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'
import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor | null
}

interface ToolbarButton {
  icon: React.ReactNode
  action: () => void
  isActive: () => boolean
  title: string
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [visible, setVisible] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      const hasSelection = from !== to
      const isEmpty = editor.isEmpty
      setVisible(hasSelection && !isEmpty)
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.on('focus', handleSelectionUpdate)
    editor.on('blur', () => {
      // Delay hiding to allow clicking toolbar buttons
      setTimeout(() => setVisible(false), 200)
    })

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      editor.off('focus', handleSelectionUpdate)
    }
  }, [editor])

  if (!editor) return null

  const buttons: ToolbarButton[] = [
    {
      icon: <Bold className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
      title: '加粗',
    },
    {
      icon: <Italic className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
      title: '斜体',
    },
    {
      icon: <Underline className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive('underline'),
      title: '下划线',
    },
    {
      icon: <Highlighter className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: () => editor.isActive('highlight'),
      title: '高亮',
    },
    {
      icon: <AlignLeft className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: () => editor.isActive({ textAlign: 'left' }),
      title: '左对齐',
    },
    {
      icon: <AlignCenter className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: () => editor.isActive({ textAlign: 'center' }),
      title: '居中',
    },
    {
      icon: <AlignRight className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: () => editor.isActive({ textAlign: 'right' }),
      title: '右对齐',
    },
  ]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 px-2 py-1.5 rounded-lg"
          style={{
            background: 'rgba(25, 26, 27, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          {buttons.map((btn, index) => (
            <motion.button
              key={btn.title}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02, duration: 0.1 }}
              onClick={(e) => {
                e.preventDefault()
                btn.action()
              }}
              onMouseDown={(e) => e.preventDefault()}
              title={btn.title}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-100"
              style={{
                color: btn.isActive()
                  ? 'var(--accent-primary)'
                  : 'var(--text-secondary)',
                background: btn.isActive()
                  ? 'rgba(94, 106, 210, 0.15)'
                  : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!btn.isActive()) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (!btn.isActive()) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              {btn.icon}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
