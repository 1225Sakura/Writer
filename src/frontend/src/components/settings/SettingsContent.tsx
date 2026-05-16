import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { SettingsCategory } from '@/store/uiStore'
import { EntityEditor } from './EntityEditor'
import { AISuggestionPanel } from './AISuggestionPanel'
import { EntitySearch } from './EntitySearch'
import { Button } from '@/components/ui/Button'
import { CanvasView } from './CanvasView'
import { ProjectDataPanel } from './ProjectDataPanel'
import { RelationGraph } from './RelationGraph'
import { SystemPanel } from './SystemPanel'
import {
  Settings, Sparkles, Menu, Network, List,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion } from 'framer-motion'
import { EntityListSkeletonPreset, SmartSkeleton } from '@/components/shared/SmartSkeleton'
import { SectionLoadingOverlay } from '@/components/shared/LoadingOverlay'
import { SPRING, DURATION, EASE } from '@/components/shared/AnimationConfig'
import { StatusBar } from './SettingsActions'

interface SettingsContentProps {
  viewMode: 'edit' | 'canvas'
  onToggleViewMode: () => void
  onMobileNavOpen: () => void
}

export function SettingsContent({ viewMode, onToggleViewMode, onMobileNavOpen }: SettingsContentProps) {
  const { settingsCategory, setSettingsCategory } = useUIStore()
  const generate = useSettingsStore((state) => state.generate)
  const isLoading = useSettingsStore((state) => state.isLoading)

  return (
    <motion.div
      className="flex-1 overflow-hidden flex flex-col min-w-0 relative"
      style={{ zIndex: 1 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH, delay: 0.1 }}
    >
      {/* Top toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-[var(--color-surface-base)] border-b border-[var(--border-subtle)] relative z-10 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onMobileNavOpen}
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
        <div className="flex items-center gap-1">
          <EntitySearch onResultClick={(type) => {
            const valid: Array<SettingsCategory> = ['world', 'character', 'item', 'location', 'faction', 'rule', 'outline', 'ifline', 'projectData', 'graph', 'system']
            if (valid.includes(type as SettingsCategory)) {
              setSettingsCategory(type as SettingsCategory)
            }
          }} />
          <div className="flex items-center gap-0.5 ml-1">
            <Button
              onClick={onToggleViewMode}
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
                if (!['outline', 'ifline', 'projectData', 'graph', 'system'].includes(settingsCategory)) {
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
      {settingsCategory === 'projectData' ? (
        <div className="flex-1 overflow-y-auto p-6 relative">
          <ProjectDataPanel />
        </div>
      ) : settingsCategory === 'graph' ? (
        <div className="flex-1 relative">
          <RelationGraph />
        </div>
      ) : settingsCategory === 'system' ? (
        <div className="flex-1 overflow-y-auto p-6 relative">
          <SystemPanel />
        </div>
      ) : viewMode === 'canvas' ? (
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
  )
}
