import { useState, useEffect, Suspense, lazy } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Check, AlertCircle, Keyboard, Zap, BarChart3,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { DURATION, EASE, SPRING } from '@/components/shared/AnimationConfig'

const RelationGraph = lazy(() => import('./RelationGraph'))

// Status bar component with smooth save state transitions and project statistics
export function StatusBar() {
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const settingsCategory = useUIStore((state) => state.settingsCategory)
  const isLoading = useSettingsStore((state) => state.isLoading)

  // Project statistics - use individual selectors to avoid object creation
  const characterCount = useSettingsStore((state) => state.characters.length)
  const itemCount = useSettingsStore((state) => state.items.length)
  const locationCount = useSettingsStore((state) => state.locations.length)
  const factionCount = useSettingsStore((state) => state.factions.length)
  const chapterCount = useSettingsStore((state) => state.chapters.length)

  const totalEntities = characterCount + itemCount + locationCount + factionCount + chapterCount

  const categoryLabels: Record<string, string> = {
    world: '世界观',
    character: '角色',
    item: '物品',
    location: '地点',
    faction: '势力',
    rule: '规则',
    outline: '大纲',
    ifline: 'IF线',
  }

  useEffect(() => {
    if (!isLoading) {
      setIsSaving(true)
      const timer = setTimeout(() => {
        setIsSaving(false)
        setLastSaved(new Date())
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading, settingsCategory])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <motion.div
      className="flex items-center justify-between px-4 py-1.5 text-xs bg-[var(--color-surface-base)] border-t border-[var(--border-subtle)] relative"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    >
      <div className="flex items-center gap-4">
        <span className="text-[var(--text-secondary)]">
          当前编辑：
          <span className="font-medium text-[var(--text-primary)]">{categoryLabels[settingsCategory]}</span>
        </span>
        <motion.div
          className="hidden lg:flex items-center gap-2 pl-3 border-l border-[var(--border-subtle)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
        >
          <Icon icon={BarChart3} size="xs" color="muted" />
          <span className="text-[var(--text-tertiary)]">
            共 <span className="font-medium text-[var(--text-secondary)]">{totalEntities}</span> 个实体
          </span>
        </motion.div>
      </div>

      <div className="flex items-center gap-1">
        <AnimatePresence mode="wait">
          {isSaving ? (
            <motion.div
              key="saving"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
              className="flex items-center gap-1.5 text-[var(--color-character)]"
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-[var(--color-warning)]"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span>保存中...</span>
            </motion.div>
          ) : lastSaved ? (
            <motion.div
              key="saved"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
              className="flex items-center gap-1.5 text-[var(--color-success)]"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={SPRING.BADGE}
              >
                <Icon icon={Check} size="xs" color="success" />
              </motion.div>
              <span>已保存 {formatTime(lastSaved)}</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
              className="flex items-center gap-1.5 text-[var(--text-tertiary)]"
            >
              <Icon icon={AlertCircle} size="xs" color="muted" />
              <span>未保存</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
        <Icon icon={Keyboard} size="xs" color="muted" />
        <span className="hidden sm:inline">
          <kbd className="px-1 py-0.5 rounded text-[10px] bg-[var(--color-surface-raised)] border border-[var(--border-subtle)]">Ctrl</kbd>
          {' + '}
          <kbd className="px-1 py-0.5 rounded text-[10px] bg-[var(--color-surface-raised)] border border-[var(--border-subtle)]">S</kbd>
        </span>
      </div>
    </motion.div>
  )
}

// Right panel: RelationGraph
export function RelationPanel() {
  const generateRelations = useSettingsStore((state) => state.generateRelations)

  return (
    <motion.div
      className="flex-shrink-0 h-full flex flex-col overflow-hidden relative bg-[var(--color-surface-raised)] border-l border-[var(--border-subtle)]
                 hidden xl:flex"
      style={{
        width: 'var(--sidebar-ai-drawer-width)',
        minWidth: 'var(--sidebar-outline-width)',
        maxWidth: 'var(--sidebar-ai-drawer-width-expanded)',
        zIndex: 1,
      }}
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH, delay: 0.15 }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] relative z-10"
      >
        <div className="flex items-center gap-2">
          <Icon icon={Zap} size="xs" color="accent" />
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            关系图谱
          </span>
        </div>
        <Button
          onClick={generateRelations}
          variant="ghost"
          size="icon"
          title="生成关系"
        >
          <Icon icon={RefreshCw} size="sm" color="inherit" />
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">加载关系图谱...</div>}>
          <RelationGraph />
        </Suspense>
      </div>
    </motion.div>
  )
}
