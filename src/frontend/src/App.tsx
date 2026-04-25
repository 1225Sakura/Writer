import { lazy, Suspense, ComponentType, useMemo, useState, useEffect, memo } from 'react'
import { useUIStore, selectNavigationState, selectDisplayModes } from '@/store'
import { shallow } from 'zustand/shallow'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { ShortcutManager } from '@/components/shared/ShortcutManager'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { ShortcutsHelp } from '@/components/shared/ShortcutsHelp'
import { PageTransition } from '@/components/shared/PageTransition'
import { ParticleBackground } from '@/components/shared/ParticleBackground'
import { DynamicBackground, type BackgroundMode } from '@/components/shared/DynamicBackground'
import { ToastContainer } from '@/components/ui/Toast'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'

// Lazy load page components for code splitting
const ChatInitPage = lazy(() => import('@/components/chat/ChatInitPage').then(m => ({ default: m.ChatInitPage as ComponentType<any> })))
const SettingEditorPage = lazy(() => import('@/components/settings/SettingEditorPage').then(m => ({ default: m.SettingEditorPage as ComponentType<any> })))
const WritingEditorPage = lazy(() => import('@/components/writing/WritingEditorPage').then(m => ({ default: m.WritingEditorPage as ComponentType<any> })))

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
      {/* Layer 1: CSS Particle Background (pure CSS, zero JS overhead) */}
      {/* Subtle floating particles above Canvas for depth */}
      <div
        className="bg-layered__particles transition-opacity duration-500"
        style={{
          opacity: minimizeBackground ? 0.3 : 1,
        }}
      >
        <MemoizedParticleBackground
          particleCount={currentInterface === 'writing' ? 4 : 8}
          interfaceType={currentInterface as 'chat' | 'settings' | 'writing'}
          showConnections={!minimizeBackground}
          mouseInteraction={!minimizeBackground}
        />
      </div>

      {/* Layer 2: Canvas Dynamic Background (mode switches with interface) */}
      {/* Primary visual interest - adapts to interface personality */}
      <div
        className="bg-layered__gradient transition-opacity duration-500"
        style={{
          opacity: minimizeBackground ? 0.5 : 1,
        }}
      >
        <MemoizedDynamicBackground
          mode={backgroundMode}
          density={backgroundDensity}
          speed={backgroundSpeed}
          className="opacity-50"
          interfaceType={currentInterface as 'chat' | 'settings' | 'writing'}
          immersive={minimizeBackground}
        />
      </div>

      {/* Layer 3: Page Content */}
      <div className="bg-layered__content relative z-10">
        <PageTransition interfaceType={currentInterface}>
          {renderInterface()}
        </PageTransition>
      </div>
    </div>
  )
}

// Memoize background components to prevent unnecessary re-renders
const MemoizedParticleBackground = memo(ParticleBackground)
const MemoizedDynamicBackground = memo(DynamicBackground)

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
