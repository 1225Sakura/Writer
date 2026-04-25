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
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Type,
  ChevronDown,
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
  shortcut?: string
}

interface ParagraphStyle {
  label: string
  icon: React.ReactNode
  action: () => void
  isActive: () => boolean
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [visible, setVisible] = useState(false)
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const styleMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      const hasSelection = from !== to
      const isEmpty = editor.isEmpty
      setVisible(hasSelection && !isEmpty)
      // Close style menu when selection changes
      setStyleMenuOpen(false)
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.on('focus', handleSelectionUpdate)
    editor.on('blur', () => {
      // Delay hiding to allow clicking toolbar buttons
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

  // Close style menu when clicking outside
  useEffect(() => {
    if (!styleMenuOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (styleMenuRef.current && !styleMenuRef.current.contains(e.target as Node)) {
        setStyleMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [styleMenuOpen])

  if (!editor) return null

  const formatButtons: ToolbarButton[] = [
    {
      icon: <Bold className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
      title: '加粗',
      shortcut: 'Ctrl+B',
    },
    {
      icon: <Italic className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
      title: '斜体',
      shortcut: 'Ctrl+I',
    },
    {
      icon: <Underline className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive('underline'),
      title: '下划线',
      shortcut: 'Ctrl+U',
    },
    {
      icon: <Highlighter className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: () => editor.isActive('highlight'),
      title: '高亮',
      shortcut: 'Ctrl+Shift+H',
    },
  ]

  const alignButtons: ToolbarButton[] = [
    {
      icon: <AlignLeft className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: () => editor.isActive({ textAlign: 'left' }) || !editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }),
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

  const paragraphStyles: ParagraphStyle[] = [
    {
      label: '正文',
      icon: <Type className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().setParagraph().run(),
      isActive: () => editor.isActive('paragraph') && !editor.isActive('heading'),
    },
    {
      label: '标题 1',
      icon: <Heading1 className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive('heading', { level: 1 }),
    },
    {
      label: '标题 2',
      icon: <Heading2 className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive('heading', { level: 2 }),
    },
    {
      label: '标题 3',
      icon: <Heading3 className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => editor.isActive('heading', { level: 3 }),
    },
  ]

  const quickFormatButtons: ToolbarButton[] = [
    {
      icon: <List className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
      title: '无序列表',
    },
    {
      icon: <ListOrdered className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
      title: '有序列表',
    },
    {
      icon: <Quote className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive('blockquote'),
      title: '引用',
    },
    {
      icon: <Minus className="w-3.5 h-3.5" />,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: () => false,
      title: '分隔线',
    },
  ]

  const getActiveStyleLabel = () => {
    for (const style of paragraphStyles) {
      if (style.isActive()) return style.label
    }
    return '正文'
  }

  const buttonVariants = {
    hidden: { opacity: 0, y: -4, scale: 0.9 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: i * 0.02,
        duration: 0.12,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    }),
  }

  const renderDivider = (index: number) => (
    <motion.div
      key={`divider-${index}`}
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ delay: index * 0.03, duration: 0.15 }}
      className="w-px h-5 mx-1 relative overflow-hidden"
      style={{ background: 'transparent' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, var(--border-default) 20%, var(--border-strong) 50%, var(--border-default) 80%, transparent 100%)',
          opacity: 0.5,
        }}
      />
    </motion.div>
  )

  const renderButton = (btn: ToolbarButton, index: number, groupIndex: number = 0) => (
    <motion.button
      key={btn.title}
      custom={index + groupIndex * 10}
      variants={buttonVariants}
      initial="hidden"
      animate="visible"
      onClick={(e) => {
        e.preventDefault()
        btn.action()
      }}
      onMouseDown={(e) => e.preventDefault()}
      title={`${btn.title}${btn.shortcut ? ` (${btn.shortcut})` : ''}`}
      aria-label={btn.title}
      className={`group relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
        btn.isActive()
          ? 'text-[var(--accent-primary)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
      style={btn.isActive() ? {
        background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent-primary) 25%, transparent), 0 0 8px color-mix(in srgb, var(--accent-primary) 15%, transparent)',
      } : {
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!btn.isActive()) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
        }
      }}
      onMouseLeave={(e) => {
        if (!btn.isActive()) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
        }
      }}
    >
      <span className={`transition-all duration-200 ${btn.isActive() ? 'drop-shadow-[0_0_5px_var(--accent-primary)]' : ''}`}>
        {btn.icon}
      </span>
      {/* Subtle hover glow for inactive buttons */}
      {!btn.isActive() && (
        <span
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--border-default) 50%, transparent), 0 0 6px color-mix(in srgb, var(--glow-primary-sm) 30%, transparent)',
          }}
        />
      )}
      {/* Tooltip */}
      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-[10px] font-medium
                     text-[var(--text-primary)] rounded-md
                     opacity-0 invisible group-hover:opacity-100 group-hover:visible
                     transition-all duration-150 whitespace-nowrap
                     before:absolute before:content-[''] before:top-0 before:left-1/2 before:-translate-x-1/2
                     before:-translate-y-full before:border-[5px] before:border-transparent"
        style={{
          background: 'var(--color-surface-overlay)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
          border: '1px solid var(--border-default)',
        }}
      >
        <span
          className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-0 h-0"
          style={{
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderBottom: '5px solid var(--color-surface-overlay)',
          }}
        />
        {btn.title}
      </span>
    </motion.button>
  )

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
            background: 'linear-gradient(180deg, rgba(25, 26, 27, 0.92) 0%, rgba(20, 21, 22, 0.96) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Paragraph style selector */}
          <div className="relative" ref={styleMenuRef}>
            <motion.button
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0, duration: 0.1 }}
              onClick={(e) => {
                e.preventDefault()
                setStyleMenuOpen(!styleMenuOpen)
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`group flex items-center gap-1.5 px-2.5 h-8 rounded-lg transition-all duration-200
                         hover:scale-102 active:scale-98 ${
                           styleMenuOpen || paragraphStyles.some(s => s.isActive())
                             ? 'text-[var(--accent-primary)]'
                             : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                         }`}
              style={styleMenuOpen || paragraphStyles.some(s => s.isActive()) ? {
                background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
                boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent-primary) 20%, transparent)',
              } : {
                background: 'transparent',
              }}
            >
              <Type className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">{getActiveStyleLabel()}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${styleMenuOpen ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
              {styleMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-full left-0 mt-1.5 py-1.5 rounded-xl z-50"
                  style={{
                    minWidth: '150px',
                    background: 'linear-gradient(180deg, rgba(28, 29, 30, 0.96) 0%, rgba(22, 23, 24, 0.98) 100%)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                >
                  {paragraphStyles.map((style, idx) => (
                    <motion.button
                      key={style.label}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.12 }}
                      onClick={(e) => {
                        e.preventDefault()
                        style.action()
                        setStyleMenuOpen(false)
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-all duration-150
                                 hover:bg-[rgba(255,255,255,0.04)] ${
                        style.isActive()
                          ? 'text-[var(--accent-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                      style={style.isActive() ? {
                        background: 'color-mix(in srgb, var(--accent-primary) 6%, transparent)',
                      } : {}}
                    >
                      <span className={style.isActive() ? 'drop-shadow-[0_0_4px_var(--accent-primary)]' : ''}>
                        {style.icon}
                      </span>
                      <span className="text-xs font-medium">{style.label}</span>
                      {style.isActive() && (
                        <motion.div
                          layoutId="activeStyleIndicator"
                          className="ml-auto w-1 h-1 rounded-full"
                          style={{ background: 'var(--accent-primary)' }}
                        />
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
