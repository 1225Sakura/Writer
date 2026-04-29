import { useWritingStore } from '@/store'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Layers, Feather, Zap } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'

export function ChapterProgress() {
  const [isExpanded, setIsExpanded] = useState(true)
  const { wordCount, targetWordCount, chapters, fetchChapters, currentChapterId } = useWritingStore()

  useEffect(() => { fetchChapters() }, [fetchChapters])

  const currentChapter = chapters.find((c) => c.id === currentChapterId)
  const totalWords = chapters.reduce((sum, c) => sum + c.word_count, 0)
  const progress = Math.min((wordCount / targetWordCount) * 100, 100)

  return (
    <CollapsibleSection
      title="章节进度"
      icon={<BarChart3 className="w-4 h-4" />}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm" style={{ color: 'var(--text-primary)' }}>
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              本章: {wordCount} / {targetWordCount} 字
            </span>
            <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--border-subtle)' }}>
            <motion.div className="h-full rounded-full relative" style={{ background: 'linear-gradient(90deg, var(--accent-100) 0%, var(--color-ifline) 60%, #9ed95a 100%)', boxShadow: '0 0 8px color-mix(in srgb, var(--accent-100) 30%, transparent)' }} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </div>
        <div className="pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1"><Layers className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />总章节: {chapters.length}</span>
            <span className="flex items-center gap-1"><Feather className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />总字数: {totalWords.toLocaleString()}</span>
          </div>
          {currentChapter && (
            <div className="flex items-center gap-1 text-xs truncate" style={{ color: 'var(--accent-primary)' }}>
              <Zap className="w-3 h-3" />
              当前: {currentChapter.title || `第${currentChapter.chapter_order}章`}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  )
}