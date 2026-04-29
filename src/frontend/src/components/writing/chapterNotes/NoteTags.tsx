import { useState } from 'react'
import { motion } from 'framer-motion'
import { Tag, Lightbulb, Bookmark, MessageSquare, CheckCircle2, AlertTriangle } from 'lucide-react'

export interface NoteCategory {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
}

export const NOTE_CATEGORIES: NoteCategory[] = [
  {
    id: 'idea',
    label: '灵感',
    icon: <Lightbulb className="w-3 h-3" />,
    color: 'var(--color-character)',
    bgColor: 'color-mix(in srgb, var(--color-character) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-character) 25%, transparent)',
  },
  {
    id: 'foreshadow',
    label: '伏笔',
    icon: <Bookmark className="w-3 h-3" />,
    color: 'var(--color-item)',
    bgColor: 'color-mix(in srgb, var(--color-item) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-item) 25%, transparent)',
  },
  {
    id: 'todo',
    label: '待办',
    icon: <CheckCircle2 className="w-3 h-3" />,
    color: 'var(--color-ifline)',
    bgColor: 'color-mix(in srgb, var(--color-ifline) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-ifline) 25%, transparent)',
  },
  {
    id: 'warning',
    label: '注意',
    icon: <AlertTriangle className="w-3 h-3" />,
    color: 'var(--color-vermillion)',
    bgColor: 'color-mix(in srgb, var(--color-vermillion) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-vermillion) 25%, transparent)',
  },
  {
    id: 'note',
    label: '笔记',
    icon: <MessageSquare className="w-3 h-3" />,
    color: 'var(--color-outline)',
    bgColor: 'color-mix(in srgb, var(--color-outline) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-outline) 25%, transparent)',
  },
]

export function NoteTags() {
  const [selectedCategory, setSelectedCategory] = useState('note')

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Tag className="w-3 h-3 mr-0.5 text-[var(--icon-muted)]" />
      {NOTE_CATEGORIES.map((category, index) => (
        <motion.button
          key={category.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: index * 0.04,
            duration: 0.2,
            ease: [0.16, 1, 0.3, 1],
          }}
          onClick={() => setSelectedCategory(category.id)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                     transition-all duration-150 hover:scale-105 active:scale-95"
          style={{
            color: selectedCategory === category.id ? category.color : 'var(--text-tertiary)',
            background:
              selectedCategory === category.id
                ? category.bgColor
                : 'color-mix(in srgb, var(--paper-100) 3%, transparent)',
            border:
              selectedCategory === category.id
                ? `1px solid ${category.borderColor}`
                : '1px solid transparent',
            boxShadow: selectedCategory === category.id
              ? `0 0 8px ${category.color}20`
              : 'none',
          }}
          title={`插入${category.label}标签`}
        >
          {category.icon}
          <span>{category.label}</span>
        </motion.button>
      ))}
    </div>
  )
}
