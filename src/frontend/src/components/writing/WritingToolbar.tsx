import { useState } from 'react'
import { motion } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import { ChevronDown, PenLine, LayoutGrid, FileText } from 'lucide-react'
import { SPRING } from '@/components/shared/AnimationConfig'
import { useUIStore } from '@/store'
import { Icon } from '@/components/ui/Icon'
import { useImmersiveModeContext } from './immersive'
import {
  ToolbarButtons,
  RatioSliderSection,
  QuickAIOperations,
  ToolbarRightSection,
  FloatingToolBar,
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

      <CorkboardToggleButton />

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

  return writingMode === 'writing' ? (
    <>
      <MinimalToolbar />
      <FloatingToolBar />
    </>
  ) : (
    <FullToolbar isSplitView={isSplitView} onToggleSplitView={onToggleSplitView} />
  )
}

function CorkboardToggleButton() {
  // v0.5 Phase 4.2 FE-022
  const { corkboardOpen, toggleCorkboard } = useUIStore(
    useShallow((s) => ({
      corkboardOpen: s.corkboardOpen,
      toggleCorkboard: s.toggleCorkboard,
    })),
  )

  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={toggleCorkboard}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 overflow-hidden flex-shrink-0 group ${
        corkboardOpen
          ? 'text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-raised)]'
      }`}
      style={corkboardOpen ? {
        background: 'var(--accent-primary)',
        border: '1px solid color-mix(in srgb, var(--accent-primary) 60%, transparent)',
        boxShadow: '0 0 16px color-mix(in srgb, var(--accent-primary) 30%, transparent), inset 0 1px 0 color-mix(in srgb, var(--paper-100) 8%, transparent)',
      } : {
        border: '1px solid transparent',
      }}
      title={corkboardOpen ? '切换到写作视图' : '切换到软木板视图'}
    >
      <Icon icon={corkboardOpen ? FileText : LayoutGrid} size="sm" color="inherit" />
      <span className="hidden sm:inline">{corkboardOpen ? '写作' : '软木板'}</span>
    </motion.button>
  )
}
