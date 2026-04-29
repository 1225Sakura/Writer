import { motion } from 'framer-motion'
import { Feather, Sparkles, Wand2 } from 'lucide-react'

interface GlobalOperationButtonProps {
  icon: React.ReactNode
  label: string
  description: string
  onClick?: () => void
}

export function GlobalOperationButton({ icon, label, description, onClick }: GlobalOperationButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 cursor-pointer text-left
                 bg-[var(--color-surface-base)] border border-[var(--border-default)]
                 hover:border-[var(--border-strong)] hover:bg-[var(--hover-bg)] hover:shadow-glow-sm"
    >
      <span
        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
        style={{ background: 'var(--accent-muted)', color: 'var(--accent-primary)' }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</div>
      </div>
    </motion.button>
  )
}

interface GenerationOptionsProps {
  onGenerateNextChapter: () => void
  onOptimizeAll: () => void
  onRemoldStyle: () => void
}

export function GenerationOptions({ onGenerateNextChapter, onOptimizeAll, onRemoldStyle }: GenerationOptionsProps) {
  return (
    <div className="space-y-2">
      <GlobalOperationButton
        icon={<Feather className="w-4 h-4" />}
        label="生成下一章"
        description="基于当前剧情自动生成"
        onClick={onGenerateNextChapter}
      />
      <GlobalOperationButton
        icon={<Sparkles className="w-4 h-4" />}
        label="优化全文"
        description="提升整体表达质量"
        onClick={onOptimizeAll}
      />
      <GlobalOperationButton
        icon={<Wand2 className="w-4 h-4" />}
        label="文笔重塑"
        description="按选定风格重写"
        onClick={onRemoldStyle}
      />
    </div>
  )
}