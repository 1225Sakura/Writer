import { useEffect } from 'react'
import { useUIStore } from '@/store'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { ShortcutManager } from '@/components/shared/ShortcutManager'
import { ToastContainer } from '@/components/ui/Toast'
import { ChatInitPage } from '@/components/chat'
import { SettingEditorPage } from '@/components/settings'
import { WritingEditorPage } from '@/components/writing'

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

  // 渲染当前界面
  const renderInterface = () => {
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
