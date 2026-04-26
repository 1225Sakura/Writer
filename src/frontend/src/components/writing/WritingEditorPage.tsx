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
  ImmersiveVignette,
  AmbientOrbs,
  SwipeHintModal,
  ImmersiveIndicator,
  ImmersiveModeProvider,
  useImmersiveModeContext,
} from './immersive'

const IMMERSIVE_SPRING = { type: 'spring' as const, stiffness: 180, damping: 24 }
const IMMERSIVE_EASE = [0.16, 1, 0.3, 1] as const

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

      {/* Immersive mode effects */}
      <ImmersiveVignette />
      <AmbientOrbs />
      <ImmersiveIndicator />

      {/* Toolbar - smoother spring physics for show/hide */}
      <AnimatePresence initial={false}>
        {(!immersiveMode || chromeVisible) && (
          <motion.div
            key="toolbar"
            initial={immersiveMode ? { opacity: 0, y: -20 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={IMMERSIVE_SPRING}
            className="relative z-20"
          >
            <WritingToolbar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主内容区 - refined z-index and spacing for immersive mode stacking */}
      <div className={`flex-1 flex overflow-hidden relative ${immersiveMode ? 'z-10' : ''}`}>
        {/* 写作区域 - subtle writing-bg texture */}
        <div className="flex-1 overflow-hidden relative">
          {/* Subtle writing background texture - organic paper grain */}
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              opacity: 0.012,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '200px 200px',
            }}
          />
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

        {/* Outline sidebar - refined edge glow */}
        <AnimatePresence initial={false}>
          {outlineDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="outline-sidebar"
              initial={{ width: 0, opacity: 0, x: -20 }}
              animate={{ width: 280, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -20 }}
              transition={{
                width: { type: 'spring', stiffness: 260, damping: 26, restSpeed: 0.5 },
                opacity: { duration: 0.3, ease: IMMERSIVE_EASE },
                x: { type: 'spring', stiffness: 260, damping: 26, restSpeed: 0.5 },
              }}
              className="border-r border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20"
              style={{
                boxShadow: `
                  4px 0 48px color-mix(in srgb, var(--color-outline) 10%, transparent),
                  2px 0 16px color-mix(in srgb, var(--color-outline) 5%, transparent),
                  inset -1px 0 0 color-mix(in srgb, var(--color-outline) 15%, transparent)
                `,
              }}
            >
              {/* Refined edge glow indicator */}
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.6, ease: IMMERSIVE_EASE }}
                className="absolute top-0 right-0 w-[2px] h-full origin-top"
                style={{
                  background: 'linear-gradient(180deg, var(--color-outline) 0%, color-mix(in srgb, var(--color-outline) 50%, transparent) 35%, color-mix(in srgb, var(--color-outline) 20%, transparent) 70%, transparent 100%)',
                  boxShadow: '0 0 12px color-mix(in srgb, var(--color-outline) 20%, transparent)',
                }}
              />
              <OutlineSidebar />
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI operation drawer - refined edge glow */}
        <AnimatePresence initial={false}>
          {aiDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="ai-drawer"
              initial={{ width: 0, opacity: 0, x: 40 }}
              animate={{ width: 320, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 40 }}
              transition={{
                width: { type: 'spring', stiffness: 240, damping: 24, restSpeed: 0.5 },
                opacity: { duration: 0.35, ease: IMMERSIVE_EASE },
                x: { type: 'spring', stiffness: 240, damping: 24, restSpeed: 0.5 }
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         max-md:fixed max-md:inset-0 max-md:w-full max-md:h-full max-md:z-50 max-md:border-none max-md:rounded-none
                         md:w-[320px] lg:w-[360px]"
              style={{
                boxShadow: `
                  -4px 0 56px color-mix(in srgb, var(--accent-primary) 14%, transparent),
                  -2px 0 24px color-mix(in srgb, var(--accent-primary) 7%, transparent),
                  inset 1px 0 0 color-mix(in srgb, var(--accent-primary) 12%, transparent)
                `,
              }}
            >
              <AIOperationDrawer />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collaboration panel - refined edge glow */}
        <AnimatePresence initial={false}>
          {collaborationDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="collab-drawer"
              initial={{ width: 0, opacity: 0, x: 30 }}
              animate={{ width: 300, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 30 }}
              transition={{
                width: { type: 'spring', stiffness: 240, damping: 24, restSpeed: 0.5 },
                opacity: { duration: 0.35, ease: IMMERSIVE_EASE },
                x: { type: 'spring', stiffness: 240, damping: 24, restSpeed: 0.5 }
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         max-md:fixed max-md:inset-0 max-md:w-full max-md:h-full max-md:z-50 max-md:border-none max-md:rounded-none"
              style={{
                boxShadow: `
                  -4px 0 56px color-mix(in srgb, var(--color-ifline) 12%, transparent),
                  -2px 0 24px color-mix(in srgb, var(--color-ifline) 6%, transparent),
                  inset 1px 0 0 color-mix(in srgb, var(--color-ifline) 10%, transparent)
                `,
              }}
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
