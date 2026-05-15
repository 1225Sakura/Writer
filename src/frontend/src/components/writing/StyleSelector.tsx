/**
 * StyleSelector - Paragraph style dropdown for the editor toolbar
 *
 * Dropdown menu for selecting paragraph styles (body text, heading 1-3).
 * Includes animated chevron, active indicator, and keyboard accessibility.
 */

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Type, ChevronDown, Heading1, Heading2, Heading3 } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import type { Editor } from '@tiptap/react'

interface ParagraphStyle {
  label: string
  icon: React.ReactNode
  action: () => void
  isActive: () => boolean
}

interface StyleSelectorProps {
  editor: Editor
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

export function StyleSelector({ editor, isOpen, onToggle, onClose }: StyleSelectorProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const paragraphStyles: ParagraphStyle[] = [
    {
      label: '正文',
      icon: <Icon icon={Type} size="xs" />,
      action: () => editor.chain().focus().setParagraph().run(),
      isActive: () => editor.isActive('paragraph') && !editor.isActive('heading'),
    },
    {
      label: '标题 1',
      icon: <Icon icon={Heading1} size="xs" />,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive('heading', { level: 1 }),
    },
    {
      label: '标题 2',
      icon: <Icon icon={Heading2} size="xs" />,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive('heading', { level: 2 }),
    },
    {
      label: '标题 3',
      icon: <Icon icon={Heading3} size="xs" />,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => editor.isActive('heading', { level: 3 }),
    },
  ]

  const getActiveStyleLabel = () => {
    for (const style of paragraphStyles) {
      if (style.isActive()) return style.label
    }
    return '正文'
  }

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0, duration: DURATION.INSTANT, ease: EASE.SMOOTH }}
        onClick={(e) => {
          e.preventDefault()
          onToggle()
        }}
        onMouseDown={(e) => e.preventDefault()}
        className={`group flex items-center gap-1.5 px-2.5 h-8 rounded-lg transition-all duration-200
                   hover:scale-102 active:scale-98 ${
                     isOpen || paragraphStyles.some(s => s.isActive())
                       ? 'text-[var(--accent-primary)]'
                       : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                   }`}
        style={isOpen || paragraphStyles.some(s => s.isActive()) ? {
          background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent-primary) 20%, transparent)',
        } : {
          background: 'transparent',
        }}
        aria-label="段落样式选择器"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Icon icon={Type} size="xs" />
        <span className="text-[11px] font-medium">{getActiveStyleLabel()}</span>
        <Icon icon={ChevronDown} size="xs" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
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
            }}
            role="listbox"
            aria-label="段落样式"
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
                  onClose()
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
                role="option"
                aria-selected={style.isActive()}
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
  )
}
