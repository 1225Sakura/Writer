import { useUIStore, useSettingsStore } from '@/store'
import type { SettingsCategory } from '@/store/uiStore'
import { CategoryNav } from './CategoryNav'
import { EntityEditor } from './EntityEditor'
import { RelationGraph } from './RelationGraph'
import { AISuggestionPanel } from './AISuggestionPanel'
import { EntitySearch } from './EntitySearch'
import { Button } from '@/components/ui/Button'
import { Settings, Feather, RefreshCw, PenTool, ArrowLeft, Check, AlertCircle, Keyboard } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EntityListSkeletonPreset, SmartSkeleton } from '@/components/shared/SmartSkeleton'
import { SectionLoadingOverlay } from '@/components/shared/LoadingOverlay'
import { useState, useEffect } from 'react'

// Status bar component showing current editing item, auto-save status, and shortcuts
function StatusBar() {
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const settingsCategory = useUIStore((state) => state.settingsCategory)
  const isLoading = useSettingsStore((state) => state.isLoading)

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
      className="flex items-center justify-between px-4 py-2 text-xs bg-[var(--color-surface-base)] border-t border-[var(--border-default)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <span className="text-[var(--text-secondary)]">
          当前编辑：<span className="font-medium text-[var(--text-primary)]">{categoryLabels[settingsCategory]}</span>
        </span>
      </div>

      <div className="flex items-center gap-1">
        <AnimatePresence mode="wait">
          {isSaving ? (
            <motion.div
              key="saving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-[var(--color-character)]"
            >
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse motion-reduce:animate-none" />
              <span>保存中...</span>
            </motion.div>
          ) : lastSaved ? (
            <motion.div
              key="saved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-[var(--color-ifline)]"
            >
              <Check className="w-3 h-3" />
              <span>已保存 {formatTime(lastSaved)}</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-[var(--text-tertiary)]"
            >
              <AlertCircle className="w-3 h-3" />
              <span>未保存</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
        <Keyboard className="w-3 h-3" />
        <span className="hidden sm:inline">
          <kbd className="px-1 py-0.5 rounded text-[10px] bg-[var(--color-surface-raised)]">Ctrl</kbd>
          {' + '}
          <kbd className="px-1 py-0.5 rounded text-[10px] bg-[var(--color-surface-raised)]">S</kbd>
          {' 保存'}
        </span>
      </div>
    </motion.div>
  )
}

export function SettingEditorPage() {
  const { settingsCategory, setCurrentInterface, setSettingsCategory } = useUIStore()
  const generateRelations = useSettingsStore((state) => state.generateRelations)
  const generate = useSettingsStore((state) => state.generate)
  const loadAll = useSettingsStore((state) => state.loadAll)
  const isLoading = useSettingsStore((state) => state.isLoading)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  return (
    <motion.div
      className="flex h-full relative bg-[var(--color-surface-base)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top-right gradient accent */}
        <div
          className="absolute top-0 right-0 w-[400px] h-[400px] opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(94,106,210,0.15) 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        {/* Bottom-left gradient accent */}
        <div
          className="absolute bottom-0 left-0 w-[300px] h-[300px] opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(232,184,125,0.1) 0%, transparent 70%)',
            transform: 'translate(-30%, 30%)',
          }}
        />
      </div>
      {/* Left: CategoryNav */}
      <motion.div
        className="flex-shrink-0 h-full overflow-hidden flex flex-col relative bg-[var(--color-surface-base)] border-r border-[var(--border-default)]"
        style={{
          width: 'var(--layout-sidebar-width, 200px)',
          minWidth: '120px',
          zIndex: 1,
        }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      >
        <CategoryNav />
      </motion.div>

      {/* Center: EntityEditor */}
      <motion.div
        className="flex-1 overflow-hidden flex flex-col min-w-0 relative"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      >
        {/* Top toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-base)] border-b border-[var(--border-default)]"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="font-medium text-sm text-[var(--text-primary)]">
              设定编辑器
            </span>
          </div>
          <div className="flex items-center gap-2">
            <EntitySearch onResultClick={(type) => {
              const valid: Array<SettingsCategory> = ['world', 'character', 'item', 'location', 'faction', 'rule', 'outline', 'ifline']
              if (valid.includes(type as SettingsCategory)) {
                setSettingsCategory(type as SettingsCategory)
              }
            }} />
            <Button
              onClick={() => setCurrentInterface('chat')}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回聊天
            </Button>
            <Button
              onClick={() => setCurrentInterface('writing')}
              variant="primary"
              size="sm"
            >
              <PenTool className="w-3.5 h-3.5" />
              开始写作
            </Button>
            <Button
              onClick={() => {
                if (settingsCategory !== 'outline' && settingsCategory !== 'ifline') {
                  generate(settingsCategory as 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule')
                }
              }}
              variant="ghost"
              size="sm"
            >
              <Feather className="w-3.5 h-3.5" />
              智能生成
            </Button>
          </div>
        </div>

        {/* Editor content area */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          <SectionLoadingOverlay visible={isLoading} message="加载实体数据..." />
          {isLoading ? (
            <div className="space-y-4">
              <SmartSkeleton variant="text" lines={1} width="30%" height={24} />
              <EntityListSkeletonPreset items={5} />
            </div>
          ) : (
            <EntityEditor category={settingsCategory} />
          )}
        </div>

        {/* AI Suggestion Panel */}
        <div className="border-t border-[var(--border-default)]"
        >
          <AISuggestionPanel />
        </div>

        {/* Bottom status bar */}
        <StatusBar />
      </motion.div>

      {/* Right: RelationGraph */}
      <motion.div
        className="flex-shrink-0 h-full flex flex-col overflow-hidden relative bg-[var(--color-surface-raised)] border-l border-[var(--border-default)]"
        style={{
          width: 'var(--layout-rightpanel-width, 320px)',
          minWidth: '240px',
          zIndex: 1,
        }}
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              关系图谱
            </span>
          </div>
          <Button
            onClick={generateRelations}
            variant="ghost"
            size="icon"
            title="生成关系"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <RelationGraph />
        </div>
      </motion.div>
    </motion.div>
  )
}
