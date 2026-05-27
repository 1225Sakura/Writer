/**
 * ToolbarButtons - Toolbar button definitions and rendering utilities
 *
 * Contains button group definitions (format, alignment, quick-format),
 * divider rendering, and individual button rendering with tooltips.
 */

import { motion } from 'framer-motion'
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Minus,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import type { Editor } from '@tiptap/react'

export interface ToolbarButton {
  icon: React.ReactNode
  action: () => void
  isActive: () => boolean
  title: string
  shortcut?: string
}

export function getFormatButtons(editor: Editor): ToolbarButton[] {
  return [
    {
      icon: <Icon icon={Bold} size="xs" />,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
      title: '加粗',
      shortcut: 'Ctrl+B',
    },
    {
      icon: <Icon icon={Italic} size="xs" />,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
      title: '斜体',
      shortcut: 'Ctrl+I',
    },
    {
      icon: <Icon icon={Underline} size="xs" />,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive('underline'),
      title: '下划线',
      shortcut: 'Ctrl+U',
    },
    {
      icon: <Icon icon={Highlighter} size="xs" />,
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: () => editor.isActive('highlight'),
      title: '高亮',
      shortcut: 'Ctrl+Shift+H',
    },
  ]
}

export function getAlignButtons(editor: Editor): ToolbarButton[] {
  return [
    {
      icon: <Icon icon={AlignLeft} size="xs" />,
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: () => editor.isActive({ textAlign: 'left' }) || !editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }),
      title: '左对齐',
    },
    {
      icon: <Icon icon={AlignCenter} size="xs" />,
      action: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: () => editor.isActive({ textAlign: 'center' }),
      title: '居中',
    },
    {
      icon: <Icon icon={AlignRight} size="xs" />,
      action: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: () => editor.isActive({ textAlign: 'right' }),
      title: '右对齐',
    },
  ]
}

export function getQuickFormatButtons(editor: Editor): ToolbarButton[] {
  return [
    {
      icon: <Icon icon={List} size="xs" />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
      title: '无序列表',
    },
    {
      icon: <Icon icon={ListOrdered} size="xs" />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
      title: '有序列表',
    },
    {
      icon: <Icon icon={Quote} size="xs" />,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive('blockquote'),
      title: '引用',
    },
    {
      icon: <Icon icon={Minus} size="xs" />,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: () => false,
      title: '分隔线',
    },
  ]
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

export function renderDivider(index: number) {
  return (
    <motion.div
      key={`divider-${index}`}
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ delay: index * 0.03, duration: DURATION.FAST, ease: EASE.SMOOTH }}
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
}

export function renderButton(btn: ToolbarButton, index: number, groupIndex: number = 0) {
  return (
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
          (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--paper-100) 6%, transparent)'
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
          boxShadow: `0 4px 12px color-mix(in srgb, var(--ink-100) 20%, transparent), 0 2px 4px color-mix(in srgb, var(--ink-100) 10%, transparent), inset 0 1px 0 color-mix(in srgb, var(--paper-100) 6%, transparent)`,
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
}
