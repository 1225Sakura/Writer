import { useUIStore, useSettingsStore } from '@/store'
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

  // Category labels
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

  // Simulate auto-save status (in real app, this would come from store)
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
      className="flex items-center justify-between px-4 py-2 text-xs"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        borderTop: '1px solid var(--color-border)',
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      {/* Current editing item */}
      <div className="flex items-center gap-3">
        <span style={{ color: 'var(--color-text-secondary)' }}>
          当前编辑：<span className="font-medium" style={{ color: 'var(--color-text)' }}>{categoryLabels[settingsCategory]}</span>
        </span>
      </div>

      {/* Auto-save status */}
      <div className="flex items-center gap-1">
        <AnimatePresence mode="wait">
          {isSaving ? (
            <motion.div
              key="saving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1"
              style={{ color: 'var(--color-character)' }}
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
              className="flex items-center gap-1"
              style={{ color: 'var(--color-ifline)' }}
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
              className="flex items-center gap-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <AlertCircle className="w-3 h-3" />
              <span>未保存</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
        <Keyboard className="w-3 h-3" />
        <span className="hidden sm:inline">
          <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--color-surface-raised)' }}>Ctrl</kbd>
          {' + '}
          <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--color-surface-raised)' }}>S</kbd>
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
      className="flex h-full relative"
      style={{ backgroundColor: 'var(--color-bg)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background decorative elements */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 0 }}
      >
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
      {/* 左侧：分类导航 */}
      <motion.div
        className="flex-shrink-0 h-full overflow-hidden flex flex-col relative"
        style={{
          width: '200px',
          minWidth: '120px',
          backgroundColor: 'var(--color-bg-surface)',
          borderRight: '1px solid var(--color-border)',
          zIndex: 1,
        }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      >
        <CategoryNav />
      </motion.div>

      {/* 中间：实体编辑器 */}
      <motion.div
        className="flex-1 overflow-hidden flex flex-col min-w-0 relative"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      >
        {/* 顶部工具栏 */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              设定编辑器
            </span>
          </div>
          <div className="flex items-center gap-2">
            <EntitySearch onResultClick={(type) => setSettingsCategory(type)} />
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

        {/* 编辑器内容区 */}
        <div className="flex-1 overflow-y-auto p-5 relative">
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

        {/* AI审查建议 */}
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <AISuggestionPanel />
        </div>

        {/* 底部状态栏 */}
        <StatusBar />
      </motion.div>

      {/* 右侧：关系图谱 */}
      <motion.div
        className="flex-shrink-0 h-full flex flex-col overflow-hidden relative"
        style={{
          width: '320px',
          minWidth: '200px',
          backgroundColor: 'var(--color-bg-primary)',
          borderLeft: '1px solid var(--color-border)',
          zIndex: 1,
        }}
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
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
