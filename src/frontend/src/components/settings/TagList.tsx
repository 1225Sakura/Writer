import { Tag, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'


interface TagListProps {
  tags: string[]
  onRemove?: (tag: string) => void
  entityType?: string
}

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  world: 'var(--color-world)',
  rule: 'var(--color-rule)',
  ifline: 'var(--color-ifline)',
  outline: 'var(--color-outline)',
}

const tagVariants = {
  initial: { opacity: 0, scale: 0.7, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.5, x: -12, transition: { duration: 0.15 } },
}

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
}

export function getTagColor(tagName: string, entityType?: string): string {
  if (entityType && ENTITY_TYPE_COLORS[entityType]) {
    return ENTITY_TYPE_COLORS[entityType]
  }

  const TAG_COLORS = [
    'var(--color-character)', 'var(--color-item)', 'var(--color-location)',
    'var(--color-faction)', 'var(--color-outline)', 'var(--color-ifline)',
    'var(--color-vermillion-red)', 'var(--color-outline)', 'var(--color-character-light)', 'var(--color-location-light)',
  ]
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

export function TagList({ tags, onRemove, entityType }: TagListProps) {
  if (!tags || tags.length === 0) return null

  return (
    <motion.div
      className="flex flex-wrap gap-1.5 mt-2"
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <AnimatePresence mode="popLayout">
        {tags.map((tag) => {
          const color = getTagColor(tag, entityType)
          return (
            <motion.span
              key={tag}
              variants={tagVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-all cursor-default group/tag"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 7%, transparent)`,
                color: color,
                border: `1px solid color-mix(in srgb, ${color} 15%, transparent)`,
                boxShadow: `0 1px 3px color-mix(in srgb, var(--ink-100) 10%, transparent), inset 0 1px 0 color-mix(in srgb, var(--paper-100) 3%, transparent)`,
              }}
              whileHover={{
                backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)`,
                borderColor: `color-mix(in srgb, ${color} 27%, transparent)`,
                boxShadow: `0 4px 14px color-mix(in srgb, ${color} 19%, transparent), 0 1px 4px color-mix(in srgb, var(--ink-100) 15%, transparent)`,
                y: -2,
              }}
            >
              <Tag className="w-3 h-3 opacity-70" />
              {tag}
              {onRemove && (
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(tag)
                  }}
                  className="p-0.5 rounded-full opacity-0 group-hover/tag:opacity-100 transition-all"
                  whileHover={{ scale: 1.3, backgroundColor: `color-mix(in srgb, ${color} 19%, transparent)` }}
                  whileTap={{ scale: 0.85, rotate: 90 }}
                  style={{ color }}
                  aria-label={`删除标签: ${tag}`}
                >
                  <X className="w-3 h-3" />
                </motion.button>
              )}
            </motion.span>
          )
        })}
      </AnimatePresence>
    </motion.div>
  )
}
