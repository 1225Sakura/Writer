import { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore, useWritingStore } from '@/store'
import { WritingToolbar } from './WritingToolbar'
import { WritingCanvas } from './WritingCanvas'
import { AIOperationDrawer } from './AIOperationDrawer'
import { CollaborationPanel } from './CollaborationPanel'
import { OutlineSidebar } from './OutlineSidebar'
import { ChapterNotesPanel } from './ChapterNotesPanel'
import { WritingSprintTimer } from './WritingSprintTimer'
import { X, ArrowLeft, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { WritingSkeleton } from '@/components/shared/SmartSkeleton'
import { SectionLoadingOverlay } from '@/components/shared/LoadingOverlay'
import { Sparkles } from 'lucide-react'

const IMMERSIVE_HIDE_DELAY = 3000 // 3 seconds

// Spring animation config for immersive transitions
const IMMERSIVE_SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 }
const IMMERSIVE_EASE = [0.16, 1, 0.3, 1] as const

// Staggered entrance animation variants for drawer content
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.08 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
}

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: IMMERSIVE_EASE } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.15 } },
}

export function WritingEditorPage() {
  const {
    aiDrawerOpen,
    collaborationDrawerOpen,
    outlineDrawerOpen,
    toggleAIDrawer,
    toggleCollaborationDrawer,
    toggleOutlineDrawer,
    immersiveMode,
    setImmersiveMode
  } = useUIStore()
  const { init, loading } = useWritingStore()

  const [chromeVisible, setChromeVisible] = useState(true)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingRef = useRef<number>(Date.now())
  const isTypingRef = useRef(false)
  const touchStartX = useRef<number>(0)
  const touchEndX = useRef<number>(0)
  const swipeThreshold = 50
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  const [swipeHintDismissed, setSwipeHintDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('writer-swipe-hint-dismissed') === '1'
    }
    return false
  })

  useEffect(() => {
    init()
  }, [init])

  // Show swipe hint on mobile after a delay
  useEffect(() => {
    if (swipeHintDismissed || window.innerWidth > 768) return
    const timer = setTimeout(() => setShowSwipeHint(true), 2000)
    return () => clearTimeout(timer)
  }, [swipeHintDismissed])

  const dismissSwipeHint = () => {
    setShowSwipeHint(false)
    setSwipeHintDismissed(true)
    localStorage.setItem('writer-swipe-hint-dismissed', '1')
  }

  // Reset chrome visibility when immersive mode is toggled off
  useEffect(() => {
    if (!immersiveMode) {
      setChromeVisible(true)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
    }
  }, [immersiveMode])

  const scheduleHideChrome = useCallback(() => {
    if (!immersiveMode) return

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    // Only hide if not typing recently (more than 1 second since last keystroke)
    const timeSinceLastTyping = Date.now() - lastTypingRef.current
    if (timeSinceLastTyping > 1000) {
      hideTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current || timeSinceLastTyping < 1000) return
        setChromeVisible(false)
      }, IMMERSIVE_HIDE_DELAY)
    }
  }, [immersiveMode])

  const showChrome = useCallback(() => {
    setChromeVisible(true)
    lastTypingRef.current = Date.now()
    isTypingRef.current = false
    scheduleHideChrome()
  }, [scheduleHideChrome])

  // Track typing in the writing canvas
  useEffect(() => {
    const handleTypingStart = () => {
      isTypingRef.current = true
      lastTypingRef.current = Date.now()
    }

    const handleTypingStop = () => {
      isTypingRef.current = false
      lastTypingRef.current = Date.now()
      scheduleHideChrome()
    }

    // Listen for typing events from the writing canvas
    document.addEventListener('immersive-typing-start', handleTypingStart)
    document.addEventListener('immersive-typing-stop', handleTypingStop)

    return () => {
      document.removeEventListener('immersive-typing-start', handleTypingStart)
      document.removeEventListener('immersive-typing-stop', handleTypingStop)
    }
  }, [scheduleHideChrome])

  // Mobile swipe gesture handler (left for outline, right for AI panel)
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.changedTouches[0].screenX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX.current = e.changedTouches[0].screenX
      const diff = touchEndX.current - touchStartX.current
      const absDiff = Math.abs(diff)

      // Only process swipes on mobile/tablet
      if (window.innerWidth > 768) return
      if (absDiff < swipeThreshold) return

      if (diff > 0) {
        // Swipe right - toggle outline sidebar
        if (!outlineDrawerOpen) {
          toggleOutlineDrawer()
        }
      } else {
        // Swipe left - toggle AI drawer
        if (!aiDrawerOpen) {
          toggleAIDrawer()
        }
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [outlineDrawerOpen, aiDrawerOpen, toggleOutlineDrawer, toggleAIDrawer])

  // Mouse move handler to show chrome
  useEffect(() => {
    if (!immersiveMode) return

    let moveTimeout: NodeJS.Timeout | null = null

    const handleMouseMove = (_e: MouseEvent) => {
      // Only show chrome if it's hidden
      if (!chromeVisible) {
        // Show chrome on mouse move, then schedule hide again
        showChrome()
      }

      // Reset typing state on any mouse movement
      lastTypingRef.current = Date.now()
      isTypingRef.current = false
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!immersiveMode) return

      // Show chrome on Escape
      if (e.key === 'Escape') {
        showChrome()
        if (immersiveMode) {
          setImmersiveMode(false)
        }
      }

      // Reset typing state on any key press
      lastTypingRef.current = Date.now()
      isTypingRef.current = false
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('keydown', handleKeyDown)

    // Start the initial hide timer when entering immersive mode
    if (immersiveMode && chromeVisible) {
      scheduleHideChrome()
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('keydown', handleKeyDown)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
      if (moveTimeout) {
        clearTimeout(moveTimeout)
      }
    }
  }, [immersiveMode, chromeVisible, showChrome, scheduleHideChrome, setImmersiveMode])

  return (
    <div className={`h-full flex flex-col bg-[var(--ink-black)] ${immersiveMode ? 'immersive-mode' : ''}`}>
      {/* Layered vignette overlay - refined multi-layer radial gradients for depth */}
      <AnimatePresence>
        {immersiveMode && (
          <motion.div
            key="vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: IMMERSIVE_EASE }}
            className="fixed inset-0 pointer-events-none z-30 immersive-vignette"
            style={{
              background: `
                /* Outer deep vignette */
                radial-gradient(ellipse 95% 90% at 50% 50%, transparent 35%, color-mix(in srgb, var(--ink-100) 50%, transparent) 70%, color-mix(in srgb, var(--ink-100) 85%, transparent) 100%),
                /* Middle vignette layer */
                radial-gradient(ellipse 80% 70% at 50% 50%, transparent 45%, color-mix(in srgb, var(--ink-95) 35%, transparent) 80%, color-mix(in srgb, var(--ink-95) 55%, transparent) 100%),
                /* Inner subtle warm glow at center */
                radial-gradient(ellipse 40% 35% at 50% 50%, color-mix(in srgb, var(--color-character) 3%, transparent) 0%, transparent 60%)
              `,
            }}
          />
        )}
      </AnimatePresence>

      {/* Subtle ambient glow orbs - smoother, more refined animations */}
      <AnimatePresence>
        {immersiveMode && (
          <motion.div
            key="ambient-glow"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 1.5, ease: IMMERSIVE_EASE }}
            className="fixed inset-0 pointer-events-none z-25"
          >
            {/* Top-right warm glow - character orange */}
            <div
              className="absolute rounded-full blur-[100px]"
              style={{
                width: '28rem',
                height: '28rem',
                top: '-12%',
                right: '-8%',
                background: 'radial-gradient(circle, color-mix(in srgb, var(--color-character) 5%, transparent) 0%, transparent 65%)',
                animation: 'ambient-orb-float 12s ease-in-out infinite',
              }}
            />
            {/* Bottom-left cool glow - outline blue */}
            <div
              className="absolute rounded-full blur-[100px]"
              style={{
                width: '24rem',
                height: '24rem',
                bottom: '-10%',
                left: '-5%',
                background: 'radial-gradient(circle, color-mix(in srgb, var(--color-outline) 4%, transparent) 0%, transparent 65%)',
                animation: 'ambient-orb-float 14s ease-in-out infinite reverse',
              }}
            />
            {/* Subtle center glow for depth */}
            <div
              className="absolute rounded-full blur-[120px]"
              style={{
                width: '20rem',
                height: '20rem',
                top: '40%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 2%, transparent) 0%, transparent 60%)',
                animation: 'ambient-orb-float 16s ease-in-out infinite',
                animationDelay: '-4s',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elegant glass-pill immersive indicator */}
      <AnimatePresence>
        {immersiveMode && chromeVisible && (
          <motion.div
            key="immersive-indicator"
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.9 }}
            transition={{ ...IMMERSIVE_SPRING, delay: 0.2 }}
            className="fixed top-4 left-4 z-40 flex items-center gap-2.5 px-3.5 py-2 rounded-full immersive-indicator"
            style={{
              background: 'color-mix(in srgb, var(--ink-90) 50%, transparent)',
              backdropFilter: 'blur(16px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
              border: '1px solid color-mix(in srgb, var(--color-character) 15%, transparent)',
              boxShadow: `
                0 2px 16px color-mix(in srgb, var(--ink-100) 15%, transparent),
                inset 0 1px 0 color-mix(in srgb, var(--paper-100) 8%, transparent)
              `,
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-3 h-3" style={{ color: 'color-mix(in srgb, var(--color-character) 70%, transparent)' }} />
            </motion.div>
            <span className="text-[11px] font-medium tracking-wider" style={{ color: 'color-mix(in srgb, var(--color-character) 85%, transparent)' }}>沉浸模式</span>
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--color-character) 60%, transparent)',
                boxShadow: '0 0 6px color-mix(in srgb, var(--color-character) 40%, transparent)',
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 工具栏 - refined show/hide with smoother spring animation */}
      <AnimatePresence initial={false}>
        {(!immersiveMode || chromeVisible) && (
          <motion.div
            key="toolbar"
            initial={immersiveMode ? { opacity: 0, y: -16 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: IMMERSIVE_EASE }}
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
          {/* Subtle writing background texture */}
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
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

        {/* 大纲侧边栏 (可收起) - enhanced with refined visual indicators */}
        <AnimatePresence initial={false}>
          {outlineDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="outline-sidebar"
              initial={{ width: 0, opacity: 0, x: -20 }}
              animate={{ width: 280, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -20 }}
              transition={{
                width: { type: 'spring', stiffness: 280, damping: 28, restSpeed: 0.5 },
                opacity: { duration: 0.25, ease: IMMERSIVE_EASE },
                x: { type: 'spring', stiffness: 280, damping: 28, restSpeed: 0.5 },
              }}
              className="border-r border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20"
              style={{
                boxShadow: '4px 0 32px color-mix(in srgb, var(--color-outline) 10%, transparent), 2px 0 8px color-mix(in srgb, var(--color-outline) 5%, transparent)',
              }}
            >
              {/* Edge glow indicator */}
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.5, ease: IMMERSIVE_EASE }}
                className="absolute top-0 right-0 w-px h-full origin-top"
                style={{
                  background: 'linear-gradient(180deg, var(--color-outline) 0%, color-mix(in srgb, var(--color-outline) 40%, transparent) 40%, transparent 100%)',
                }}
              />
              <OutlineSidebar />
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI操作抽屉 - refined header with gradient title + glow close button + staggered content */}
        <AnimatePresence initial={false}>
          {aiDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="ai-drawer"
              initial={{ width: 0, opacity: 0, x: 40 }}
              animate={{ width: 320, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 40 }}
              transition={{
                width: { type: 'spring', stiffness: 260, damping: 26, restSpeed: 0.5 },
                opacity: { duration: 0.3, ease: IMMERSIVE_EASE },
                x: { type: 'spring', stiffness: 260, damping: 26, restSpeed: 0.5 }
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         max-md:fixed max-md:inset-0 max-md:w-full max-md:h-full max-md:z-50 max-md:border-none
                         md:w-[320px] lg:w-[360px]"
              style={{
                boxShadow: '-4px 0 40px color-mix(in srgb, var(--accent-primary) 18%, transparent), -2px 0 16px color-mix(in srgb, var(--accent-primary) 8%, transparent)',
              }}
            >
              {/* Animated edge glow indicator */}
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.5, ease: IMMERSIVE_EASE }}
                className="absolute top-0 left-0 w-px h-full origin-top"
                style={{
                  background: 'linear-gradient(180deg, var(--accent-primary) 0%, color-mix(in srgb, var(--accent-primary) 50%, transparent) 50%, transparent 100%)',
                  boxShadow: '0 0 8px color-mix(in srgb, var(--accent-primary) 30%, transparent)',
                }}
              />
              {/* Refined header with gradient title */}
              <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between min-w-0 w-full relative overflow-hidden">
                {/* Subtle header gradient background */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 4%, transparent) 0%, transparent 60%)',
                  }}
                />
                <motion.span
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12, duration: 0.35, ease: IMMERSIVE_EASE }}
                  className="font-semibold text-sm relative z-10"
                  style={{
                    background: 'linear-gradient(135deg, var(--text-primary) 0%, color-mix(in srgb, var(--accent-primary) 80%, var(--text-primary)) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  写作操作
                </motion.span>
                <motion.button
                  initial={{ opacity: 0, rotate: -45 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.18, duration: 0.3, ease: IMMERSIVE_EASE }}
                  onClick={toggleAIDrawer}
                  className="relative z-10 flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                  whileHover={{
                    scale: 1.1,
                    backgroundColor: 'color-mix(in srgb, var(--color-vermillion) 12%, transparent)',
                    boxShadow: '0 0 12px color-mix(in srgb, var(--color-vermillion) 25%, transparent)',
                  }}
                  whileTap={{ scale: 0.92 }}
                  style={{ background: 'transparent' }}
                >
                  <motion.div
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <X className="w-4 h-4 text-[var(--text-secondary)]" />
                  </motion.div>
                </motion.button>
              </div>
              {/* Staggered content entrance */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex-1 overflow-y-auto"
              >
                <motion.div variants={staggerItem}>
                  <AIOperationDrawer />
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 协作面板 - refined header with gradient title + glow close button + staggered content */}
        <AnimatePresence initial={false}>
          {collaborationDrawerOpen && (!immersiveMode || chromeVisible) && (
            <motion.div
              key="collab-drawer"
              initial={{ width: 0, opacity: 0, x: 30 }}
              animate={{ width: 300, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 30 }}
              transition={{
                width: { type: 'spring', stiffness: 260, damping: 26, restSpeed: 0.5 },
                opacity: { duration: 0.3, ease: IMMERSIVE_EASE },
                x: { type: 'spring', stiffness: 260, damping: 26, restSpeed: 0.5 }
              }}
              className="drawer-responsive drawer-right border-l border-[var(--border-default)] bg-[var(--color-surface-raised)] flex flex-col overflow-hidden relative z-20
                         max-md:fixed max-md:inset-0 max-md:w-full max-md:h-full max-md:z-50 max-md:border-none"
              style={{
                boxShadow: '-4px 0 40px color-mix(in srgb, var(--color-ifline) 16%, transparent), -2px 0 16px color-mix(in srgb, var(--color-ifline) 8%, transparent)',
              }}
            >
              {/* Animated edge glow indicator */}
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.5, ease: IMMERSIVE_EASE }}
                className="absolute top-0 left-0 w-px h-full origin-top"
                style={{
                  background: 'linear-gradient(180deg, var(--color-ifline) 0%, color-mix(in srgb, var(--color-ifline) 50%, transparent) 50%, transparent 100%)',
                  boxShadow: '0 0 8px color-mix(in srgb, var(--color-ifline) 25%, transparent)',
                }}
              />
              {/* Refined header with gradient title */}
              <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between min-w-0 w-full relative overflow-hidden">
                {/* Subtle header gradient background */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-ifline) 4%, transparent) 0%, transparent 60%)',
                  }}
                />
                <motion.span
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12, duration: 0.35, ease: IMMERSIVE_EASE }}
                  className="font-semibold text-sm relative z-10"
                  style={{
                    background: 'linear-gradient(135deg, var(--text-primary) 0%, color-mix(in srgb, var(--color-ifline) 80%, var(--text-primary)) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  协作面板
                </motion.span>
                <motion.button
                  initial={{ opacity: 0, rotate: -45 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.18, duration: 0.3, ease: IMMERSIVE_EASE }}
                  onClick={toggleCollaborationDrawer}
                  className="relative z-10 flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                  whileHover={{
                    scale: 1.1,
                    backgroundColor: 'color-mix(in srgb, var(--color-ifline) 12%, transparent)',
                    boxShadow: '0 0 12px color-mix(in srgb, var(--color-ifline) 20%, transparent)',
                  }}
                  whileTap={{ scale: 0.92 }}
                  style={{ background: 'transparent' }}
                >
                  <motion.div
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <X className="w-4 h-4 text-[var(--text-secondary)]" />
                  </motion.div>
                </motion.button>
              </div>
              {/* Staggered content entrance */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex-1 overflow-y-auto"
              >
                <motion.div variants={staggerItem}>
                  <CollaborationPanel />
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile swipe hint overlay */}
      <AnimatePresence>
        {showSwipeHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 flex items-center justify-center md:hidden"
            style={{
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(2px)',
            }}
            onClick={dismissSwipeHint}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="mx-6 p-5 rounded-2xl max-w-xs w-full"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--border-default)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-primary">手势操作提示</span>
                <button
                  onClick={dismissSwipeHint}
                  className="p-1 rounded-lg hover:bg-surface-base transition-colors"
                >
                  <X className="w-4 h-4 text-secondary" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-base flex items-center justify-center">
                    <motion.div
                      animate={{ x: [0, 8, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <ArrowLeft className="w-5 h-5 text-accent-primary" />
                    </motion.div>
                  </div>
                  <div>
                    <div className="text-sm text-primary">从左向右滑</div>
                    <div className="text-xs text-secondary">打开大纲侧边栏</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-base flex items-center justify-center">
                    <motion.div
                      animate={{ x: [0, -8, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                    >
                      <ArrowRight className="w-5 h-5 text-accent-primary" />
                    </motion.div>
                  </div>
                  <div>
                    <div className="text-sm text-primary">从右向左滑</div>
                    <div className="text-xs text-secondary">打开 AI 操作面板</div>
                  </div>
                </div>
              </div>
              <button
                onClick={dismissSwipeHint}
                className="w-full mt-4 py-2 text-xs rounded-lg bg-accent-primary text-white hover:bg-accent-hover transition-colors"
              >
                知道了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
