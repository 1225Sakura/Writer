import { lazy, Suspense, ComponentType, useMemo, useState, useEffect } from 'react'
import type { BackgroundMode } from '@/components/shared/DynamicBackground'
import { useUIStore, selectDisplayModes } from '@/store'
import { shallow } from 'zustand/shallow'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { ShortcutManager } from '@/components/shared/ShortcutManager'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { ShortcutsHelp } from '@/components/shared/ShortcutsHelp'
import { PageTransition } from '@/components/shared/PageTransition'
import { ToastContainer } from '@/components/ui/Toast'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'

// Lazy load page components for code splitting
const ChatInitPage = lazy(() => import('@/components/chat/ChatInitPage').then(m => ({ default: m.ChatInitPage as ComponentType<any> })))
const SettingEditorPage = lazy(() => import('@/components/settings/SettingEditorPage').then(m => ({ default: m.SettingEditorPage as ComponentType<any> })))
const WritingEditorPage = lazy(() => import('@/components/writing/WritingEditorPage').then(m => ({ default: m.WritingEditorPage as ComponentType<any> })))

// Lazy load background components for better initial bundle
const LazyParticleBackground = lazy(() => import('@/components/shared/ParticleBackground').then(m => ({ default: m.ParticleBackground as ComponentType<any> })))
const LazyDynamicBackground = lazy(() => import('@/components/shared/DynamicBackground').then(m => ({ default: m.DynamicBackground as ComponentType<any> })))

/**
 * Background mode mapping per interface type
 * Each interface has a unique visual personality
 */
function getBackgroundMode(interfaceType: string): BackgroundMode {
  switch (interfaceType) {
    case 'chat':
      return 'particle' // Warm, active, social
    case 'settings':
      return 'grid'     // Structured, organized
    case 'writing':
      return 'starfield' // Calm, focused, immersive
    default:
      return 'particle'
  }
}

/**
 * Background density mapping per interface
 * Writing gets lower density for focus
 */
function getBackgroundDensity(interfaceType: string): 'low' | 'medium' | 'high' {
  switch (interfaceType) {
    case 'chat':
      return 'medium'
    case 'settings':
      return 'medium'
    case 'writing':
      return 'low' // Minimal distraction
    default:
      return 'medium'
  }
}

/**
 * Background speed mapping per interface
 */
function getBackgroundSpeed(interfaceType: string): 'slow' | 'normal' | 'fast' {
  switch (interfaceType) {
    case 'chat':
      return 'normal'
    case 'settings':
      return 'slow'
    case 'writing':
      return 'slow' // Calm, steady
    default:
      return 'normal'
  }
}

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
 * CSS-only fallback background for prefers-reduced-motion
 * Renders a static gradient that matches the theme
 */
function CSSOnlyBackground({ interfaceType, className }: { interfaceType: string; className?: string }) {
  const gradient = useMemo(() => {
    const baseColor = 'var(--ink-90, #1a1a2e)'
    const accentColor = 'var(--accent-100, #5e6ad2)'
    switch (interfaceType) {
      case 'chat':
        return `radial-gradient(ellipse at 20% 80%, ${accentColor}08 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, ${baseColor} 0%, transparent 50%)`
      case 'settings':
        return `linear-gradient(135deg, ${baseColor} 0%, ${accentColor}05 100%)`
      case 'writing':
        return `radial-gradient(ellipse at center, ${baseColor}40 0%, transparent 70%)`
      default:
        return `radial-gradient(ellipse at center, ${baseColor}40 0%, transparent 70%)`
    }
  }, [interfaceType])

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: gradient,
        pointerEvents: 'none',
      }}
    />
  )
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
 * 3-layer background stacking strategy:
 * Layer 0 (z-index: -3): Solid color base via bg-layered::before
 * Layer 1 (z-index: -2): Canvas dynamic background (DynamicBackground)
 * Layer 2 (z-index: -1): CSS particle overlay (ParticleBackground)
 * Layer 3 (z-index: 0+): Page content
 *
 * Coordination strategy:
 * - Canvas layer provides main dynamic visual interest
 * - CSS particles provide subtle floating accents
 * - Canvas uses opacity 0.4-0.6, CSS particles use very low opacity 0.01-0.02
 * - All layers use consistent theme color palette
 * - Interface switching triggers smooth background transitions
 * - Writing interface minimizes both layers for focus
 * - Crossfade effect on background mode changes
 * - Immersive mode further reduces background opacity
 */
function AppContent() {
  // Use selectors to only subscribe to needed state slices
  const currentInterface = useUIStore((state) => state.currentInterface)
  const { immersiveMode, focusModeEnabled } = useUIStore(selectDisplayModes, shallow)
  const [transitioning, setTransitioning] = useState(false)
  const [displayInterface, setDisplayInterface] = useState(currentInterface)

  const backgroundMode = useMemo(() => getBackgroundMode(currentInterface), [currentInterface])
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
      {/* Layer 1: CSS Particle Background - Lazy loaded with Suspense */}
      {/* Subtle floating particles above Canvas for depth */}
      {/* CSS-only fallback for prefers-reduced-motion */}
      {prefersReducedMotion ? (
        <CSSOnlyBackground interfaceType={currentInterface} className="bg-layered__particles" />
      ) : (
        <Suspense fallback={<BackgroundFallback />}>
          <div
            className="bg-layered__particles transition-opacity duration-500"
            style={{
              opacity: minimizeBackground ? 0.3 : 1,
            }}
          >
            <LazyParticleBackground
              particleCount={isMobile ? 4 : (currentInterface === 'writing' ? 4 : 8)}
              interfaceType={currentInterface as 'chat' | 'settings' | 'writing'}
              showConnections={!minimizeBackground && !isMobile}
              mouseInteraction={!minimizeBackground && !isMobile}
            />
          </div>
        </Suspense>
      )}

      {/* Layer 2: Canvas Dynamic Background - Lazy loaded with Suspense */}
      {/* Primary visual interest - adapts to interface personality */}
      {/* CSS-only fallback for prefers-reduced-motion */}
      {prefersReducedMotion ? (
        <CSSOnlyBackground interfaceType={currentInterface} className="bg-layered__gradient" />
      ) : (
        <Suspense fallback={<BackgroundFallback />}>
          <div
            className="bg-layered__gradient transition-opacity duration-500"
            style={{
              opacity: minimizeBackground ? 0.5 : 1,
            }}
          >
            <LazyDynamicBackground
              mode={backgroundMode}
              density={isMobile ? 'low' : backgroundDensity}
              speed={backgroundSpeed}
              className="opacity-50"
              interfaceType={currentInterface as 'chat' | 'settings' | 'writing'}
              immersive={minimizeBackground}
            />
          </div>
        </Suspense>
      )}

      {/* Layer 3: Page Content */}
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
