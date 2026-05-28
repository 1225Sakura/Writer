import { motion } from 'framer-motion'
import { Feather, Sparkles, Wand2, Loader2 } from 'lucide-react'

interface GlobalOperationButtonProps {
  icon: React.ReactNode
  label: string
  description: string
  onClick?: () => void
  isLoading?: boolean
}

export function GlobalOperationButton({ icon, label, description, onClick, isLoading }: GlobalOperationButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={isLoading}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 cursor-pointer text-left
                 bg-[var(--color-surface-base)] border border-[var(--border-default)]
                 hover:border-[var(--border-strong)] hover:bg-[var(--hover-bg)] hover:shadow-glow-sm
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-surface-base)] disabled:hover:border-[var(--border-default)]"
    >
      <span
        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
        style={{ background: 'var(--accent-muted)', color: 'var(--accent-primary)' }}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{isLoading ? '处理中...' : description}</div>
      </div>
    </motion.button>
  )
}

interface GenerationOptionsProps {
  onGenerateNextChapter: () => void | Promise<void>
  onOptimizeAll: () => void | Promise<void>
  onRemoldStyle: () => void | Promise<void>
  loading?: string | null
}

export function GenerationOptions({ onGenerateNextChapter, onOptimizeAll, onRemoldStyle, loading }: GenerationOptionsProps) {
  return (
    <div className="space-y-2">
      <GlobalOperationButton
        icon={<Feather className="w-4 h-4" />}
        label="生成下一章"
        description="基于当前剧情自动生成"
        onClick={onGenerateNextChapter}
        isLoading={loading === 'generate'}
      />
      <GlobalOperationButton
        icon={<Sparkles className="w-4 h-4" />}
        label="优化全文"
        description="提升整体表达质量"
        onClick={onOptimizeAll}
        isLoading={loading === 'optimize'}
      />
      <GlobalOperationButton
        icon={<Wand2 className="w-4 h-4" />}
        label="文笔重塑"
        description="按选定风格重写"
        onClick={onRemoldStyle}
        isLoading={loading === 'remold'}
      />
    </div>
  )
}