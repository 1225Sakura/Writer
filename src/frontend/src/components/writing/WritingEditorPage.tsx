import { useEffect } from 'react'
import { useUIStore, useWritingStore } from '@/store'
import { WritingToolbar } from './WritingToolbar'
import { WritingCanvas } from './WritingCanvas'
import { AIOperationDrawer } from './AIOperationDrawer'
import { CollaborationPanel } from './CollaborationPanel'
import { OutlineSidebar } from './OutlineSidebar'
import { ChapterNotesPanel } from './ChapterNotesPanel'
import { WritingSprintTimer } from './WritingSprintTimer'
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
const DRAWER_EDGE_SHADOW = '0 0 32px rgba(0,0,0,0.14), 0 0 8px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(255,255,255,0.02)'

function WritingEditorPageContent() {
  const {
    aiDrawerOpen,
    collaborationDrawerOpen,
    outlineDrawerOpen,
    toggleAIDrawer,
    toggleOutlineDrawer,
  } = useUIStore()
  const { init, loading } = useWritingStore()
  const { immersiveMode, chromeVisible } = useImmersiveModeContext()

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
    <div className={`h-full flex flex-col bg-[var(--ink-black)] ${immersiveMode ? 'immersive-mode' : ''}`}>
      {/* Mobile-safe top inset spacer */}
      <div className="h-[env(safe-area-inset-top)] bg-[var(--color-surface-base)] flex-shrink-0" />

      {/* Immersive vignette overlay - ink wash aesthetic */}
      <ImmersiveVignette />

      {/* Immersive mode indicator */}
      <ImmersiveIndicator />

      {/* Toolbar - glassmorphism with smart show/hide */}
      <AnimatePresence initial={false}>
        {(!immersiveMode || chromeVisible) && (
          <motion.div
            key="toolbar"
            initial={immersiveMode ? { opacity: 0, y: -16 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={SPRING.IMMERSIVE}
            className="relative z-20"
          >
            <WritingToolbar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className={`flex-1 flex overflow-hidden relative ${immersiveMode ? 'z-10' : ''}`}>
        {/* Writing area - textured paper background for immersion */}
        <div className="flex-1 overflow-hidden relative textured-paper writing-texture-bg">
          <SectionLoadingOverlay
            visible={loading.chapters || loading.outlines}
            message="加载章节数据..."
          />
          {(loading.chapters || loading.outlines) ? (
            <div className="h-full bg-[var(--writing-bg)] overflow-y-auto relative z-10">
              <WritingSkeleton />
            </div>
          ) : (
            <WritingCanvas />
          )}
        </div>

        {/* Floating components */}
        <ChapterNotesPanel />
        <WritingSprintTimer />

        {/* Outline sidebar - unified edge style with ink shadow */}
        <AnimatePresence initial={false}>
          {outlineDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="outline-sidebar"
              initial={{ width: 0, opacity: 0, x: -24 }}
              animate={{ width: 280, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -24 }}
              transition={{
                width: { type: 'spring', stiffness: 280, damping: 28, restSpeed: 0.5 },
                opacity: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
                x: SPRING.DRAWER,
              }}
              className="border-r border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20"
              style={{ boxShadow: DRAWER_EDGE_SHADOW }}
            >
              <OutlineSidebar />
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI operation drawer - unified edge style with ink shadow */}
        <AnimatePresence initial={false}>
          {aiDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="ai-drawer"
              initial={{ width: 0, opacity: 0, x: 48 }}
              animate={{ width: 320, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 48 }}
              transition={{
                width: SPRING.DRAWER,
                opacity: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
                x: SPRING.DRAWER
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         max-md:fixed max-md:inset-0 max-md:w-full max-md:h-full max-md:z-50 max-md:border-none max-md:rounded-none
                         md:w-[320px] lg:w-[360px]"
              style={{ boxShadow: DRAWER_EDGE_SHADOW }}
            >
              <AIOperationDrawer />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collaboration panel - unified edge style with ink shadow */}
        <AnimatePresence initial={false}>
          {collaborationDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="collab-drawer"
              initial={{ width: 0, opacity: 0, x: 36 }}
              animate={{ width: 300, opacity: 1, x: 0 }}
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
