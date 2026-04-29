import { lazy, Suspense, ComponentType, useMemo, useState, useEffect } from 'react'
import { useUIStore } from '@/store'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { ShortcutManager } from '@/components/shared/ShortcutManager'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { ShortcutsHelp } from '@/components/shared/ShortcutsHelp'
import { PageTransition } from '@/components/shared/PageTransition'
import { ToastContainer } from '@/components/ui/Toast'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import {
  UnifiedBackground,
  getBackgroundModeForInterface,
  getBackgroundDensity,
  getBackgroundSpeed,
} from '@/components/shared/UnifiedBackground'

// Lazy load page components for code splitting
const ChatInitPage = lazy(() => import('@/components/chat/ChatInitPage').then(m => ({ default: m.ChatInitPage as ComponentType<any> })))
const SettingEditorPage = lazy(() => import('@/components/settings/SettingEditorPage').then(m => ({ default: m.SettingEditorPage as ComponentType<any> })))
const WritingEditorPage = lazy(() => import('@/components/writing/WritingEditorPage').then(m => ({ default: m.WritingEditorPage as ComponentType<any> })))

/**
 * CSS class for interface-specific base background
 */
function getInterfaceBgClass(interfaceType: string): string {
  switch (interfaceType) {
    case 'chat':
      return 'bg-chat'
    case 'settings':
      return 'bg-settings'
    case 'writing':
      return 'bg-writing'
    default:
      return 'bg-chat'
  }
}

/**
 * Background fallback while loading (no JS overhead)
 */
function BackgroundFallback() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--ink-90, #1a1a2e)',
        pointerEvents: 'none',
      }}
    />
  )
}

/**
 * 2-layer background stacking strategy:
 * Layer 0 (z-index: -1): UnifiedBackground (Canvas/CSS effects)
 * Layer 1 (z-index: 0+): Page content
 *
 * Coordination strategy:
 * - UnifiedBackground provides all dynamic visual effects in a single layer
 * - CSS-only fallback for prefers-reduced-motion
 * - Immersive mode reduces background opacity
 * - Interface switching triggers smooth background transitions
 */
function AppContent() {
  // Use selectors to only subscribe to needed state slices
  const currentInterface = useUIStore((state) => state.currentInterface)
  const immersiveMode = useUIStore((state) => state.immersiveMode)
  const focusModeEnabled = useUIStore((state) => state.focusModeEnabled)
  const [transitioning, setTransitioning] = useState(false)
  const [displayInterface, setDisplayInterface] = useState(currentInterface)

  const backgroundMode = useMemo(() => getBackgroundModeForInterface(currentInterface), [currentInterface])
  const backgroundDensity = useMemo(() => getBackgroundDensity(currentInterface), [currentInterface])
  const backgroundSpeed = useMemo(() => getBackgroundSpeed(currentInterface), [currentInterface])
  const bgClass = useMemo(() => getInterfaceBgClass(currentInterface), [currentInterface])

  // Interface transition with background crossfade
  useEffect(() => {
    if (currentInterface !== displayInterface) {
      setTransitioning(true)
      const timer = setTimeout(() => {
        setDisplayInterface(currentInterface)
        setTransitioning(false)
      }, 300) // Match CSS transition duration
      return () => clearTimeout(timer)
    }
  }, [currentInterface, displayInterface])

  // Determine if we should minimize backgrounds
  const isImmersive = immersiveMode || focusModeEnabled
  const isWriting = currentInterface === 'writing'
  const minimizeBackground = isWriting && isImmersive

  // Mobile optimization: detect low-performance devices
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768
  }, [])

  // CSS-only fallback for prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Render current interface with per-component Suspense boundaries
  const renderInterface = () => {
    const loadingFallback = (
      <div className="h-screen w-screen overflow-hidden bg-[var(--color-black)] flex items-center justify-center">
        <LoadingOverlay visible={true} message="正在加载..." fullscreen={false} />
      </div>
    )

    switch (displayInterface) {
      case 'chat':
        return (
          <Suspense fallback={loadingFallback}>
            <ErrorBoundary pageName="聊天">
              <ChatInitPage />
            </ErrorBoundary>
          </Suspense>
        )
      case 'settings':
        return (
          <Suspense fallback={loadingFallback}>
            <ErrorBoundary pageName="设定编辑">
              <SettingEditorPage />
            </ErrorBoundary>
          </Suspense>
        )
      case 'writing':
        return (
          <Suspense fallback={loadingFallback}>
            <ErrorBoundary pageName="写作">
              <WritingEditorPage />
            </ErrorBoundary>
          </Suspense>
        )
      default:
        return (
          <Suspense fallback={loadingFallback}>
            <ErrorBoundary pageName="聊天">
              <ChatInitPage />
            </ErrorBoundary>
          </Suspense>
        )
    }
  }

  return (
    <div
      className={`h-screen w-screen overflow-hidden relative bg-layered ${bgClass} ${transitioning ? 'bg-transitioning' : ''}`}
    >
      {/* Layer 0: Unified Background - single component for all effects */}
      {prefersReducedMotion ? (
        <BackgroundFallback />
      ) : (
        <Suspense fallback={<BackgroundFallback />}>
          <div
            className="bg-layered__unified transition-opacity duration-500"
            style={{
              opacity: minimizeBackground ? 0.3 : 1,
            }}
          >
            <UnifiedBackground
              mode={backgroundMode}
              density={isMobile ? 'low' : backgroundDensity}
              speed={backgroundSpeed}
              interfaceType={currentInterface as 'chat' | 'settings' | 'writing'}
              immersive={minimizeBackground}
            />
          </div>
        </Suspense>
      )}

      {/* Layer 1: Page Content */}
      <div className="bg-layered__content relative z-10">
        <PageTransition interfaceType={currentInterface}>
          {renderInterface()}
        </PageTransition>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ShortcutManager />
        <CommandPalette />
        <ShortcutsHelp />
        <AppContent />
        <ToastContainer />
      </ThemeProvider>
    </ErrorBoundary>
  )
}
