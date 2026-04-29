import { useUIStore, useSettingsStore } from '@/store'
import type { SettingsCategory } from '@/store/uiStore'
import { CategoryNav } from './CategoryNav'
import { EntityEditor } from './EntityEditor'
import { RelationGraph } from './RelationGraph'
import { AISuggestionPanel } from './AISuggestionPanel'
import { EntitySearch } from './EntitySearch'
import { Button } from '@/components/ui/Button'
import {
  Settings, RefreshCw, PenTool, ArrowLeft, Check, AlertCircle,
  Keyboard, Sparkles, BarChart3, Zap, Menu, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EntityListSkeletonPreset, SmartSkeleton } from '@/components/shared/SmartSkeleton'
import { SectionLoadingOverlay } from '@/components/shared/LoadingOverlay'
import { useState, useEffect } from 'react'
import { EASE, DURATION, SPRING } from '@/components/shared/AnimationConfig'

// Status bar component with smooth save state transitions and project statistics
function StatusBar() {
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const settingsCategory = useUIStore((state) => state.settingsCategory)
  const isLoading = useSettingsStore((state) => state.isLoading)

  // Project statistics
  const stats = useSettingsStore((state) => ({
    characters: state.characters.length,
    items: state.items.length,
    locations: state.locations.length,
    factions: state.factions.length,
    chapters: state.chapters.length,
  }))

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

  const totalEntities = stats.characters + stats.items + stats.locations + stats.factions + stats.chapters

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
        {/* Project stats - subtle */}
        <motion.div
          className="hidden lg:flex items-center gap-2 pl-3 border-l border-[var(--border-subtle)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
        >
          <BarChart3 className="w-3 h-3 text-[var(--text-tertiary)]" />
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
                <Check className="w-3 h-3" />
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
              <AlertCircle className="w-3 h-3" />
              <span>未保存</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
        <Keyboard className="w-3 h-3" />
        <span className="hidden sm:inline">
          <kbd className="px-1 py-0.5 rounded text-[10px] bg-[var(--color-surface-raised)] border border-[var(--border-subtle)]">Ctrl</kbd>
          {' + '}
          <kbd className="px-1 py-0.5 rounded text-[10px] bg-[var(--color-surface-raised)] border border-[var(--border-subtle)]">S</kbd>
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  return (
    <motion.div
      className="flex h-full relative bg-[var(--color-surface-base)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    >
      {/* Clean background - no embedded decorative elements */}

      {/* Left: CategoryNav */}
      <motion.div
        className="flex-shrink-0 h-full overflow-hidden flex flex-col relative bg-[var(--color-surface-base)] border-r border-[var(--border-subtle)]
                   hidden md:flex"
        style={{
          width: 'var(--layout-sidebar-width, 200px)',
          minWidth: '160px',
          maxWidth: '280px',
          zIndex: 1,
        }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH, delay: 0.05 }}
      >
        <CategoryNav />
      </motion.div>

      {/* Center: EntityEditor */}
      <motion.div
        className="flex-1 overflow-hidden flex flex-col min-w-0 relative"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH, delay: 0.1 }}
      >
        {/* Top toolbar - refined height, subtle shadow, grouped buttons */}
        <div
          className="flex items-center justify-between px-4 py-2 bg-[var(--color-surface-base)] border-b border-[var(--border-subtle)] relative z-10 shadow-sm"
        >
          <div className="flex items-center gap-2">
            {/* Mobile: Hamburger menu button */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden mobile-menu-btn mr-1 btn-active-scale"
              aria-label="打开分类菜单"
            >
              <Menu className="w-4 h-4" />
            </button>
            <motion.div
              whileHover={{ rotate: 15 }}
              transition={SPRING.SNAPPY}
            >
              <Settings className="w-4 h-4 text-[var(--accent-primary)]" />
            </motion.div>
            <span className="font-medium text-sm text-[var(--text-primary)]">
              设定编辑器
            </span>
          </div>
          {/* Button group with unified styling */}
          <div className="flex items-center gap-1">
            <EntitySearch onResultClick={(type) => {
              const valid: Array<SettingsCategory> = ['world', 'character', 'item', 'location', 'faction', 'rule', 'outline', 'ifline']
              if (valid.includes(type as SettingsCategory)) {
                setSettingsCategory(type as SettingsCategory)
              }
            }} />
            <div className="flex items-center gap-0.5 ml-1">
              <Button
                onClick={() => setCurrentInterface('chat')}
                variant="ghost"
                size="sm"
                className="gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                返回
              </Button>
              <Button
                onClick={() => {
                  if (settingsCategory !== 'outline' && settingsCategory !== 'ifline') {
                    generate(settingsCategory as 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule')
                  }
                }}
                variant="ghost"
                size="sm"
                className="gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                生成
              </Button>
              <Button
                onClick={() => setCurrentInterface('writing')}
                variant="accent"
                size="sm"
                className="gap-1"
              >
                <PenTool className="w-3.5 h-3.5" />
                写作
              </Button>
            </div>
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
        <div className="border-t border-[var(--border-subtle)] relative z-10">
          <AISuggestionPanel />
        </div>

        {/* Bottom status bar */}
        <StatusBar />
      </motion.div>

      {/* Right: RelationGraph */}
      <motion.div
        className="flex-shrink-0 h-full flex flex-col overflow-hidden relative bg-[var(--color-surface-raised)] border-l border-[var(--border-subtle)]
                   hidden xl:flex"
        style={{
          width: 'var(--layout-rightpanel-width, 320px)',
          minWidth: '280px',
          maxWidth: '400px',
          zIndex: 1,
        }}
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH, delay: 0.15 }}
      >
        {/* Panel header */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] relative z-10"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
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
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <RelationGraph />
        </div>
      </motion.div>

      {/* Mobile: CategoryNav fullscreen overlay */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mobile-drawer-overlay mobile-drawer-overlay--open md:hidden"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={SPRING.DRAWER}
              className="fixed top-0 left-0 bottom-0 w-[280px] max-w-[80vw] z-50 bg-[var(--color-surface-base)] border-r border-[var(--border-default)] flex flex-col md:hidden"
              style={{
                boxShadow: 'var(--shadow-drawer)',
              }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                <span className="font-medium text-sm text-[var(--text-primary)]">分类导航</span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="mobile-menu-btn btn-active-scale"
                  aria-label="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <CategoryNav />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
