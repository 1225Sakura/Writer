import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { SettingsCategory } from '@/store/uiStore'
import { CategoryNav } from './CategoryNav'
import { EntityEditor } from './EntityEditor'
import { RelationGraph } from './RelationGraph'
import { AISuggestionPanel } from './AISuggestionPanel'
import { EntitySearch } from './EntitySearch'
import { Button } from '@/components/ui/Button'
import { LeftSidebar } from '@/components/shared/LeftSidebar'
import { CanvasView } from './CanvasView'
import {
  Settings, RefreshCw, Check, AlertCircle,
  Keyboard, Sparkles, BarChart3, Zap, Menu, Network, List,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
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
        {/* Project stats - subtle */}
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

export function SettingEditorPage() {
  const { settingsCategory, setSettingsCategory } = useUIStore()
  const generateRelations = useSettingsStore((state) => state.generateRelations)
  const generate = useSettingsStore((state) => state.generate)
  const loadAll = useSettingsStore((state) => state.loadAll)
  const isLoading = useSettingsStore((state) => state.isLoading)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'canvas'>('edit')

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

      {/* Left: CategoryNav via shared LeftSidebar */}
      <LeftSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        showOnMobile
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        width="var(--sidebar-left-width)"
      >
        <CategoryNav />
      </LeftSidebar>

      {/* Center: EntityEditor or CanvasView */}
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
              <Icon icon={Menu} size="sm" color="inherit" />
            </button>
            <motion.div
              whileHover={{ rotate: 15 }}
              transition={SPRING.SNAPPY}
            >
              <Icon icon={Settings} size="sm" color="accent" />
            </motion.div>
            <span className="font-medium text-sm text-[var(--text-primary)]">
              {viewMode === 'canvas' ? '画布视图' : '设定编辑器'}
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
                onClick={() => setViewMode(viewMode === 'edit' ? 'canvas' : 'edit')}
                variant="ghost"
                size="sm"
                className="gap-1"
                title={viewMode === 'edit' ? '切换到画布视图' : '切换到编辑视图'}
              >
                {viewMode === 'edit' ? <Icon icon={Network} size="xs" color="inherit" /> : <Icon icon={List} size="xs" color="inherit" />}
                {viewMode === 'edit' ? '画布' : '编辑'}
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
                <Icon icon={Sparkles} size="xs" color="accent" />
                生成
              </Button>
            </div>
          </div>
        </div>

        {/* Editor content area */}
        {viewMode === 'canvas' ? (
          <div className="flex-1 relative">
            <CanvasView />
          </div>
        ) : (
          <>
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
          </>
        )}

        {/* Bottom status bar */}
        <StatusBar />
      </motion.div>

      {/* Right: RelationGraph (hidden in canvas mode) */}
      {viewMode !== 'canvas' && <motion.div
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
        {/* Panel header */}
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
          <RelationGraph />
        </div>
      </motion.div>}

    </motion.div>
  )
}
