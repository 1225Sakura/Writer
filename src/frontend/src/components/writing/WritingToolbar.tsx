import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, PenLine } from 'lucide-react'
import { SPRING } from '@/components/shared/AnimationConfig'
import { useImmersiveModeContext } from './immersive'
import {
  ToolbarButtons,
  RatioSliderSection,
  QuickAIOperations,
  ToolbarRightSection,
} from './toolbar'
import { SplitViewButton } from './SplitEditorView'

function MinimalToolbar() {
  const { toggleWritingMode } = useImmersiveModeContext()

  return (
    <motion.div
      layout
      transition={SPRING.SNAPPY}
      className="flex items-center justify-between px-3 sm:px-4 h-[var(--layout-topbar-height)] layout-topbar overflow-x-auto writing-toolbar"
      style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--border-default)' }}
    >
      <span className="text-sm text-[var(--text-secondary)] truncate flex-1">
        {/* Chapter title placeholder - rendered by parent context */}
      </span>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-[var(--text-tertiary)]">
          {/* Word count placeholder */}
        </span>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleWritingMode}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          title="切换到协作模式 (Ctrl+.)"
        >
          <PenLine className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  )
}

function FullToolbar({
  isSplitView = false,
  onToggleSplitView,
}: {
  isSplitView?: boolean
  onToggleSplitView?: () => void
}) {
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)

  return (
    <motion.div
      layout
      transition={SPRING.SNAPPY}
      className={`flex items-center px-3 sm:px-4 gap-1.5 sm:gap-2 layout-topbar overflow-x-auto writing-toolbar ${toolbarCollapsed ? 'h-0 opacity-0 overflow-hidden' : 'h-[var(--layout-topbar-height)]'}`}
      style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--border-default)' }}
    >
      <ToolbarButtons />

      <div className="hidden lg:flex items-center gap-2 ml-2 flex-shrink-0">
        <div className="w-px h-5 flex-shrink-0 mx-0.5" style={{ background: 'linear-gradient(to bottom, transparent, var(--border-default) 20%, var(--border-default) 80%, transparent)' }} />
        <RatioSliderSection />
      </div>

      <QuickAIOperations />

      <SplitViewButton
        isSplit={isSplitView}
        onToggle={onToggleSplitView ?? (() => {})}
      />

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
        className="hidden md:flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors flex-shrink-0"
        title={toolbarCollapsed ? '展开工具栏' : '收起工具栏'}
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-250 ${toolbarCollapsed ? 'rotate-180' : ''}`} />
      </motion.button>

      <ToolbarRightSection />
    </motion.div>
  )
}

export function WritingToolbar({
  isSplitView,
  onToggleSplitView,
}: {
  isSplitView?: boolean
  onToggleSplitView?: () => void
}) {
  const { writingMode } = useImmersiveModeContext()

  return writingMode === 'writing' ? <MinimalToolbar /> : <FullToolbar isSplitView={isSplitView} onToggleSplitView={onToggleSplitView} />
}
