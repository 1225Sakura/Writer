import { WritingStyle } from '@/store'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const writingStyles: Array<{ value: WritingStyle; label: string; description: string; color: string }> = [
  { value: 'default', label: '默认', description: '标准网络小说风格', color: 'var(--accent-primary)' },
  { value: 'jiangnan', label: '江南', description: '细腻描写，意境悠远', color: 'var(--color-character)' },
  { value: 'kafka', label: '卡夫卡', description: '荒诞隐喻，意识流', color: 'var(--color-item)' },
  { value: 'camus', label: '加缪', description: '哲学思辨，冷峻叙事', color: 'var(--color-location)' },
  { value: 'custom', label: '自定义', description: '上传参考文本', color: 'var(--color-vermillion)' },
]

interface StyleSelectorProps {
  writingStyle: WritingStyle
  onStyleChange: (style: WritingStyle) => void
}

export function StyleSelector({ writingStyle, onStyleChange }: StyleSelectorProps) {
  return (
    <div className="space-y-1.5">
      {writingStyles.map((style) => (
        <motion.button
          key={style.value}
          onClick={() => onStyleChange(style.value)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-left"
          style={{
            background: writingStyle === style.value ? 'var(--accent-muted)' : 'var(--color-surface-base)',
            borderColor: writingStyle === style.value ? 'color-mix(in srgb, var(--accent-primary) 40%, transparent)' : 'var(--border-default)',
          }}
          onMouseEnter={(e) => {
            if (writingStyle !== style.value) {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }
          }}
          onMouseLeave={(e) => {
            if (writingStyle !== style.value) {
              e.currentTarget.style.borderColor = 'var(--border-default)'
            }
          }}
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{
              backgroundColor: style.color,
              boxShadow: `0 0 8px color-mix(in srgb, ${style.color} 25%, transparent)`,
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{style.label}</div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{style.description}</div>
          </div>
          {writingStyle === style.value && <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />}
        </motion.button>
      ))}
    </div>
  )
}