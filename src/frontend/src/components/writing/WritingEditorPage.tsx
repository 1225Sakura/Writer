import { useEffect, useState } from 'react'
import { useUIStore, useWritingStore } from '@/store'
import { WritingToolbar } from './WritingToolbar'
import { WritingCanvas } from './WritingCanvas'
import { SplitEditorView } from './SplitEditorView'
import { CorkboardView } from './corkboard'
import { SearchReplaceBar } from './SearchReplaceBar'
import { AIOperationDrawer } from './AIOperationDrawer'
import { AICheckerPanel } from './AICheckerPanel'
import { CollaborationPanel } from './CollaborationPanel'
import { OutlineSidebar } from './OutlineSidebar'
import { ChapterNotesPanel } from './ChapterNotesPanel'
import { WritingSprintTimer } from './WritingSprintTimer'
import { SnapshotPanel } from './snapshots'
import { LeftSidebar } from '@/components/shared/LeftSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { WritingSkeleton } from '@/components/shared/SmartSkeleton'
import { SectionLoadingOverlay } from '@/components/shared/LoadingOverlay'
import {
  SwipeHintModal,
  ImmersiveIndicator,
  ImmersiveVignette,
  ImmersiveModeProvider,
  useImmersiveModeContext,
} from './immersive'

import { EASE, DURATION, SPRING } from '@/components/shared/AnimationConfig'

/** Unified subtle shadow for drawer edges - ink wash aesthetic */
const DRAWER_EDGE_SHADOW = 'var(--shadow-drawer)'

function WritingEditorPageContent() {
  const {
    aiDrawerOpen,
    collaborationDrawerOpen,
    outlineDrawerOpen,
    checkerDrawerOpen,
    snapshotDrawerOpen,
    corkboardOpen,
    toggleAIDrawer,
    toggleOutlineDrawer,
    toggleSnapshotDrawer,
  } = useUIStore()
  const loading = useWritingStore((s) => s.loading)
  const init = useWritingStore((s) => s.init)
  const currentChapterId = useWritingStore((s) => s.currentChapterId)
  const { immersiveMode, chromeVisible, writingMode } = useImmersiveModeContext()
  const [isSplitView, setIsSplitView] = useState(false)

  useEffect(() => {
    init()
  }, [init])

  const handleOpenOutline = () => {
    if (!outlineDrawerOpen) {
      toggleOutlineDrawer()
    }
  }

  const handleOpenAIOperation = () => {
    if (!aiDrawerOpen) {
      toggleAIDrawer()
    }
  }

  return (
    <div className={`h-full flex flex-col bg-[var(--ink-100)] ${immersiveMode ? 'immersive-mode' : ''}`}>
      {/* Mobile-safe top inset spacer */}
      <div className="h-[env(safe-area-inset-top)] bg-[var(--color-surface-base)] flex-shrink-0" />

      {/* Immersive vignette overlay - ink wash aesthetic */}
      <ImmersiveVignette />

      {/* Immersive mode indicator */}
      <ImmersiveIndicator />

      {/* Toolbar - vintage wood-grain strip with smart show/hide */}
      <AnimatePresence initial={false}>
        {(writingMode === 'writing' || (!immersiveMode || chromeVisible)) && (
          <motion.div
            key="toolbar"
            initial={immersiveMode ? { opacity: 0, y: -16 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={SPRING.IMMERSIVE}
            className="relative z-20"
          >
            <WritingToolbar
              isSplitView={isSplitView}
              onToggleSplitView={() => setIsSplitView(!isSplitView)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className={`flex-1 flex overflow-hidden relative ${immersiveMode ? 'z-10' : ''}`}>
        {/* Writing area - textured paper background for immersion */}
        <div className="flex-1 overflow-hidden relative textured-paper writing-texture-bg min-w-[var(--canvas-min-width)]">
          <SectionLoadingOverlay
            visible={loading.chapters || loading.outlines}
            message="加载章节数据..."
          />
          {(loading.chapters || loading.outlines) ? (
            <div className="h-full bg-[var(--writing-bg)] overflow-y-auto scrollbar-ink relative z-10">
              <WritingSkeleton />
            </div>
          ) : corkboardOpen ? (
            <CorkboardView />
          ) : isSplitView ? (
            <SplitEditorView onClose={() => setIsSplitView(false)} />
          ) : (
            <>
              <WritingCanvas />
              <SearchReplaceBar />
            </>
          )}
        </div>

        {/* Floating components */}
        <ChapterNotesPanel />
        <WritingSprintTimer />

        {/* Outline sidebar via shared LeftSidebar */}
        <LeftSidebar
          isOpen={writingMode === 'collaboration' && outlineDrawerOpen && (!immersiveMode || chromeVisible)}
          onToggle={toggleOutlineDrawer}
          width="var(--sidebar-outline-width)"
          visible={writingMode === 'collaboration' && (!immersiveMode || chromeVisible || outlineDrawerOpen)}
        >
          <OutlineSidebar />
        </LeftSidebar>

        {/* AI operation drawer - unified edge style with ink shadow */}
        <AnimatePresence initial={false}>
          {writingMode === 'collaboration' && aiDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="ai-drawer"
              initial={{ width: 0, opacity: 0, x: 48 }}
              animate={{ width: 'var(--sidebar-ai-drawer-width)', opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 48 }}
              transition={{
                width: SPRING.DRAWER,
                opacity: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
                x: SPRING.DRAWER
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         max-md:fixed max-md:inset-0 max-md:w-full max-md:h-full max-md:z-50 max-md:border-none max-md:rounded-none
                         md:w-[var(--sidebar-ai-drawer-width)] lg:w-[var(--sidebar-ai-drawer-width-expanded)]"
              style={{ boxShadow: DRAWER_EDGE_SHADOW }}
            >
              <AIOperationDrawer />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collaboration panel - unified edge style with ink shadow */}
        <AnimatePresence initial={false}>
          {writingMode === 'collaboration' && collaborationDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="collab-drawer"
              initial={{ width: 0, opacity: 0, x: 36 }}
              animate={{ width: 280, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 36 }}
              transition={{
                width: SPRING.DRAWER,
                opacity: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
                x: SPRING.DRAWER
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         max-md:fixed max-md:inset-0 max-md:w-full max-md:h-full max-md:z-50 max-md:border-none max-md:rounded-none"
              style={{ boxShadow: DRAWER_EDGE_SHADOW }}
            >
              <CollaborationPanel />
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Checker panel - unified edge style with ink shadow */}
        <AnimatePresence initial={false}>
          {writingMode === 'collaboration' && checkerDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="checker-drawer"
              initial={{ width: 0, opacity: 0, x: 48 }}
              animate={{ width: 'var(--sidebar-ai-drawer-width)', opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 48 }}
              transition={{
                width: SPRING.DRAWER,
                opacity: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
                x: SPRING.DRAWER
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         max-md:fixed max-md:inset-0 max-md:w-full max-md:h-full max-md:z-50 max-md:border-none max-md:rounded-none
                         md:w-[var(--sidebar-ai-drawer-width)] lg:w-[var(--sidebar-ai-drawer-width-expanded)]"
              style={{ boxShadow: DRAWER_EDGE_SHADOW }}
            >
              <AICheckerPanel />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Snapshot panel drawer - version history */}
        <AnimatePresence initial={false}>
          {snapshotDrawerOpen && currentChapterId && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="snapshot-drawer"
              initial={{ width: 0, opacity: 0, x: 48 }}
              animate={{ width: 'var(--sidebar-ai-drawer-width)', opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 48 }}
              transition={{
                width: SPRING.DRAWER,
                opacity: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
                x: SPRING.DRAWER
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         max-md:fixed max-md:inset-0 max-md:w-full max-md:h-full max-md:z-50 max-md:border-none max-md:rounded-none
                         md:w-[var(--sidebar-ai-drawer-width)] lg:w-[var(--sidebar-ai-drawer-width-expanded)]"
              style={{ boxShadow: DRAWER_EDGE_SHADOW }}
            >
              <SnapshotPanel chapterId={currentChapterId} onClose={toggleSnapshotDrawer} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile swipe hint overlay */}
      <SwipeHintModal
        onOpenOutline={handleOpenOutline}
        onOpenAIOperation={handleOpenAIOperation}
      />

      {/* Mobile-safe bottom inset spacer */}
      <div className="h-[env(safe-area-inset-bottom)] bg-[var(--color-surface-base)] flex-shrink-0 md:hidden" />
    </div>
  )
}

export function WritingEditorPage() {
  return (
    <ImmersiveModeProvider>
      <WritingEditorPageContent />
    </ImmersiveModeProvider>
  )
}
