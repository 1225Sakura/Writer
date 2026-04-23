import { useEffect, lazy, Suspense, ComponentType } from 'react'
import { useUIStore } from '@/store'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { ShortcutManager } from '@/components/shared/ShortcutManager'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { ShortcutsHelp } from '@/components/shared/ShortcutsHelp'
import { PageTransition } from '@/components/shared/PageTransition'
import { ParticleBackground } from '@/components/shared/ParticleBackground'
import { ToastContainer } from '@/components/ui/Toast'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'

// Lazy load page components for code splitting
const ChatInitPage = lazy(() => import('@/components/chat/ChatInitPage').then(m => ({ default: m.ChatInitPage as ComponentType<any> })))
const SettingEditorPage = lazy(() => import('@/components/settings/SettingEditorPage').then(m => ({ default: m.SettingEditorPage as ComponentType<any> })))
const WritingEditorPage = lazy(() => import('@/components/writing/WritingEditorPage').then(m => ({ default: m.WritingEditorPage as ComponentType<any> })))

function AppContent() {
  const { currentInterface, theme } = useUIStore()

  // 应用主题到 HTML 元素
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  // 渲染当前界面 with per-component Suspense boundaries to isolate loading states
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
    <div className="h-screen w-screen overflow-hidden relative">
      <ParticleBackground />
      <PageTransition interfaceType={currentInterface}>
        {renderInterface()}
      </PageTransition>
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
