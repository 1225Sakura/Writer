import { lazy, Suspense, ComponentType, useMemo } from 'react'
import { useUIStore } from '@/store'
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
 * 根据当前界面类型获取对应的背景模式
 * chat -> particle (温暖活跃的粒子)
 * settings -> grid (结构化网格)
 * writing -> starfield (静谧星空)
 */
function getBackgroundMode(interfaceType: string): BackgroundMode {
  switch (interfaceType) {
    case 'chat':
      return 'particle'
    case 'settings':
      return 'grid'
    case 'writing':
      return 'starfield'
    default:
      return 'particle'
  }
}

/**
 * 根据当前界面类型获取对应的背景CSS类
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

function AppContent() {
  const { currentInterface } = useUIStore()

  const backgroundMode = useMemo(() => getBackgroundMode(currentInterface), [currentInterface])
  const bgClass = useMemo(() => getInterfaceBgClass(currentInterface), [currentInterface])

  // Render current interface with per-component Suspense boundaries to isolate loading states
  const renderInterface = () => {
    const loadingFallback = (
      <div className="h-screen w-screen overflow-hidden bg-[var(--color-black)] flex items-center justify-center">
        <LoadingOverlay visible={true} message="正在加载..." fullscreen={false} />
      </div>
    )

    switch (currentInterface) {
      case 'chat':
        return (
          <Suspense fallback={loadingFallback}>
            <ChatInitPage />
          </Suspense>
        )
      case 'settings':
        return (
          <Suspense fallback={loadingFallback}>
            <SettingEditorPage />
          </Suspense>
        )
      case 'writing':
        return (
          <Suspense fallback={loadingFallback}>
            <WritingEditorPage />
          </Suspense>
        )
      default:
        return (
          <Suspense fallback={loadingFallback}>
            <ChatInitPage />
          </Suspense>
        )
    }
  }

  return (
    <div className={`h-screen w-screen overflow-hidden relative bg-layered ${bgClass}`}>
      {/* Layer 1: CSS Particle Background (纯CSS，零JS开销) */}
      <div className="bg-layered__particles">
        <ParticleBackground particleCount={16} showConnections={false} />
      </div>

      {/* Layer 2: Canvas Dynamic Background (根据界面切换模式) */}
      <div className="bg-layered__gradient">
        <DynamicBackground
          mode={backgroundMode}
          density="medium"
          speed="slow"
          className="opacity-50"
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
