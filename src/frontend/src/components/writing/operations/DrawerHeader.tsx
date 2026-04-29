import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'

export function DrawerHeader() {
  return (
    <div className="flex items-center gap-3 pb-3 mb-1">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
        }}
      >
        <Bot className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          AI 写作助手
        </h3>
        <p className="text-[10px] leading-tight flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
          <span className="inline-block w-1 h-1 rounded-full" style={{ background: 'var(--accent-primary)' }} />
          智能辅助 · 实时生成
        </p>
      </div>
    </div>
  )
}