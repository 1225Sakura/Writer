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

const IMMERSIVE_HIDE_DELAY = 4000 // 4 seconds - more relaxed timing

// Spring animation config for immersive transitions
// Softer spring for more natural, less jarring motion
const IMMERSIVE_SPRING = { type: 'spring' as const, stiffness: 220, damping: 28 }
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
      {/* Mobile-safe top inset spacer */}
      <div className="h-[env(safe-area-inset-top)] bg-[var(--color-surface-base)] flex-shrink-0" />
      {/* Layered vignette overlay - 5-layer radial gradients for depth perception */}
      <AnimatePresence>
        {immersiveMode && (
          <motion.div
            key="vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: IMMERSIVE_EASE }}
            className="fixed inset-0 pointer-events-none z-30 immersive-vignette"
            style={{
              background: `
                /* Layer 1: Outer deep vignette - softest falloff */
                radial-gradient(ellipse 100% 95% at 50% 50%, transparent 35%, color-mix(in srgb, var(--ink-100) 20%, transparent) 65%, color-mix(in srgb, var(--ink-100) 65%, transparent) 100%),
                /* Layer 2: Mid vignette - medium depth */
                radial-gradient(ellipse 80% 70% at 50% 50%, transparent 45%, color-mix(in srgb, var(--ink-95) 15%, transparent) 75%, color-mix(in srgb, var(--ink-95) 40%, transparent) 100%),
                /* Layer 3: Inner vignette - tight focus */
                radial-gradient(ellipse 55% 50% at 50% 50%, transparent 55%, color-mix(in srgb, var(--ink-90) 10%, transparent) 85%, color-mix(in srgb, var(--ink-90) 25%, transparent) 100%),
                /* Layer 4: Warm paper center glow - reduces eye strain */
                radial-gradient(ellipse 30% 25% at 50% 50%, color-mix(in srgb, var(--paper-100) 5%, transparent) 0%, transparent 60%),
                /* Layer 5: Subtle character warmth at focus area */
                radial-gradient(ellipse 20% 18% at 50% 50%, color-mix(in srgb, var(--color-character) 2%, transparent) 0%, transparent 75%)
              `,
            }}
          />
        )}
      </AnimatePresence>

      {/* Ambient glow orbs - organic floating with entity color blending */}
      <AnimatePresence>
        {immersiveMode && (
          <motion.div
            key="ambient-glow"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 2.0, ease: IMMERSIVE_EASE }}
            className="fixed inset-0 pointer-events-none z-25"
          >
            {/* Orb 1: Top-right warm glow - character orange, large and soft */}
            <div
              className="absolute rounded-full"
              style={{
                width: '28rem',
                height: '28rem',
                top: '-12%',
                right: '-8%',
                background: 'radial-gradient(circle, color-mix(in srgb, var(--color-character) 5%, transparent) 0%, color-mix(in srgb, var(--color-character) 1.5%, transparent) 35%, transparent 70%)',
                filter: 'blur(70px)',
                animation: 'ambient-orb-float 18s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
              }}
            />
            {/* Orb 2: Bottom-left cool glow - outline blue, medium drift */}
            <div
              className="absolute rounded-full"
              style={{
                width: '22rem',
                height: '22rem',
                bottom: '-10%',
                left: '-5%',
                background: 'radial-gradient(circle, color-mix(in srgb, var(--color-outline) 4%, transparent) 0%, color-mix(in srgb, var(--color-outline) 1%, transparent) 40%, transparent 75%)',
                filter: 'blur(80px)',
                animation: 'ambient-orb-float 22s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite reverse',
              }}
            />
            {/* Orb 3: Subtle center glow - primary accent, very soft */}
            <div
              className="absolute rounded-full"
              style={{
                width: '20rem',
                height: '20rem',
                top: '45%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 2.5%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 0.8%, transparent) 45%, transparent 80%)',
                filter: 'blur(90px)',
                animation: 'ambient-orb-float 20s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
                animationDelay: '-6s',
              }}
            />
            {/* Orb 4: Small accent - IF line green, upper left */}
            <div
              className="absolute rounded-full"
              style={{
                width: '14rem',
                height: '14rem',
                top: '10%',
                left: '-3%',
                background: 'radial-gradient(circle, color-mix(in srgb, var(--color-ifline) 2.5%, transparent) 0%, transparent 65%)',
                filter: 'blur(60px)',
                animation: 'ambient-orb-float 15s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
                animationDelay: '-3s',
              }}
            />
            {/* Orb 5: Small accent - item purple, lower right */}
            <div
              className="absolute rounded-full"
              style={{
                width: '12rem',
                height: '12rem',
                bottom: '8%',
                right: '-2%',
                background: 'radial-gradient(circle, color-mix(in srgb, var(--color-item) 2.5%, transparent) 0%, transparent 65%)',
                filter: 'blur(60px)',
                animation: 'ambient-orb-float 17s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite reverse',
                animationDelay: '-8s',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refined glass-pill immersive indicator */}
      <AnimatePresence>
        {immersiveMode && chromeVisible && (
          <motion.div
            key="immersive-indicator"
            initial={{ opacity: 0, y: -12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.92 }}
            transition={{ ...IMMERSIVE_SPRING, delay: 0.15 }}
            className="fixed top-5 left-5 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full immersive-indicator"
            style={{
              background: 'color-mix(in srgb, var(--ink-90) 40%, transparent)',
              backdropFilter: 'blur(20px) saturate(1.1)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.1)',
              border: '1px solid color-mix(in srgb, var(--paper-100) 8%, transparent)',
              boxShadow: `
                0 4px 24px color-mix(in srgb, var(--ink-100) 12%, transparent),
                inset 0 1px 0 color-mix(in srgb, var(--paper-100) 6%, transparent)
              `,
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
              className="flex items-center justify-center"
            >
              <Sparkles className="w-3 h-3" style={{ color: 'color-mix(in srgb, var(--color-character) 55%, transparent)' }} />
            </motion.div>
            <span className="text-[10px] font-medium tracking-[0.12em] uppercase" style={{ color: 'color-mix(in srgb, var(--paper-100) 55%, transparent)' }}>沉浸模式</span>
            <motion.div
              className="w-1 h-1 rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--color-character) 50%, transparent)',
                boxShadow: '0 0 8px color-mix(in srgb, var(--color-character) 30%, transparent)',
              }}
              animate={{
                opacity: [0.4, 1, 0.4],
                scale: [0.9, 1.1, 0.9],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar - smoother spring physics for show/hide */}
      <AnimatePresence initial={false}>
        {(!immersiveMode || chromeVisible) && (
          <motion.div
            key="toolbar"
            initial={immersiveMode ? { opacity: 0, y: -20 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              type: 'spring',
              stiffness: 180,
              damping: 24,
              restDelta: 0.5,
            }}
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
              {/* Refined edge glow indicator */}
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.6, ease: IMMERSIVE_EASE }}
                className="absolute top-0 left-0 w-[2px] h-full origin-top"
                style={{
                  background: 'linear-gradient(180deg, var(--accent-primary) 0%, color-mix(in srgb, var(--accent-primary) 55%, transparent) 40%, color-mix(in srgb, var(--accent-primary) 20%, transparent) 75%, transparent 100%)',
                  boxShadow: '0 0 12px color-mix(in srgb, var(--accent-primary) 25%, transparent)',
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
              {/* Refined edge glow indicator */}
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.6, ease: IMMERSIVE_EASE }}
                className="absolute top-0 left-0 w-[2px] h-full origin-top"
                style={{
                  background: 'linear-gradient(180deg, var(--color-ifline) 0%, color-mix(in srgb, var(--color-ifline) 55%, transparent) 40%, color-mix(in srgb, var(--color-ifline) 20%, transparent) 75%, transparent 100%)',
                  boxShadow: '0 0 12px color-mix(in srgb, var(--color-ifline) 20%, transparent)',
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
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={dismissSwipeHint}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="mx-6 p-5 rounded-2xl max-w-xs w-full"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--border-default)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-primary">手势操作提示</span>
                <button
                  onClick={dismissSwipeHint}
                  className="p-2 rounded-lg hover:bg-surface-base transition-colors touch-target-min"
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
                className="w-full mt-4 py-2.5 text-xs rounded-lg bg-accent-primary text-white hover:bg-accent-hover transition-colors touch-target-min btn-active-scale"
              >
                知道了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile-safe bottom inset spacer */}
      <div className="h-[env(safe-area-inset-bottom)] bg-[var(--color-surface-base)] flex-shrink-0 md:hidden" />
    </div>
  )
}
