import { useEffect, lazy, Suspense, ComponentType } from 'react'
import { useUIStore } from '@/store'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { ShortcutManager } from '@/components/shared/ShortcutManager'
import { ToastContainer } from '@/components/ui/Toast'
import { Loader2 } from 'lucide-react'

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

  // 渲染当前界面 with lazy loading
  const renderInterface = () => {
    const content = () => {
      switch (currentInterface) {
        case 'chat':
          return <ChatInitPage />
        case 'settings':
          return <SettingEditorPage />
        case 'writing':
          return <WritingEditorPage />
        default:
          return <ChatInitPage />
      }
    }

    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
        {content()}
      </Suspense>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden">{renderInterface()}</div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ShortcutManager />
      <AppContent />
      <ToastContainer />
    </ThemeProvider>
  )
}
