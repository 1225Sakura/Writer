import { useEffect, useCallback } from 'react'
import { useUIStore, useWritingStore } from '@/store'
import { getEditorInstance } from '@/store/editorRegistry'
import {
  AI_SHORTCUT_OPERATIONS,
  type AIOperationType,
} from '@/constants/shortcuts'
import type { InterfaceType } from '@/store/uiStore'
import { showToast } from '@/components/ui/Toast'
import { executeAIOperation } from './ShortcutRegistry'

/** 全局快捷键管理器 Hook — 处理所有界面的全局快捷键 */
export function useGlobalShortcuts() {
  const currentInterface = useUIStore((s) => s.currentInterface)
  const aiDrawerOpen = useUIStore((s) => s.aiDrawerOpen)
  const collaborationDrawerOpen = useUIStore((s) => s.collaborationDrawerOpen)
  const immersiveMode = useUIStore((s) => s.immersiveMode)
  const focusModeEnabled = useUIStore((s) => s.focusModeEnabled)
  const theme = useUIStore((s) => s.theme)
  const toggleAIDrawer = useUIStore((s) => s.toggleAIDrawer)
  const toggleCollaborationDrawer = useUIStore((s) => s.toggleCollaborationDrawer)
  const toggleOutlineDrawer = useUIStore((s) => s.toggleOutlineDrawer)
  const toggleFullscreenWriting = useUIStore((s) => s.toggleFullscreenWriting)
  const toggleImmersiveMode = useUIStore((s) => s.toggleImmersiveMode)
  const toggleFocusMode = useUIStore((s) => s.toggleFocusMode)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const setCurrentInterface = useUIStore((s) => s.setCurrentInterface)
  const currentChapterId = useWritingStore((s) => s.currentChapterId)
  const saveCurrentChapter = useWritingStore((s) => s.saveCurrentChapter)
  const createChapter = useWritingStore((s) => s.createChapter)
  const markSaved = useWritingStore((s) => s.markSaved)

  const handleSave = useCallback(async () => {
    if (currentInterface === 'writing') {
      if (!currentChapterId) {
        showToast('没有可保存的章节', 'warning')
        return
      }
      try {
        await saveCurrentChapter()
        markSaved()
        showToast('保存成功', 'success')
      } catch {
        showToast('保存失败', 'error')
      }
    } else if (currentInterface === 'settings') {
      showToast('设定已自动保存', 'info')
    }
  }, [currentInterface, currentChapterId, saveCurrentChapter, markSaved])

  const handleNewChapter = useCallback(async () => {
    if (currentInterface !== 'writing') return
    try {
      const chapter = await createChapter({
        title: `新章节 ${new Date().toLocaleTimeString()}`,
        status: 'planning',
      })
      showToast(`已创建章节: ${chapter.title}`, 'success')
    } catch {
      showToast('创建章节失败', 'error')
    }
  }, [currentInterface, createChapter])

  const handleFullscreen = useCallback(() => {
    if (currentInterface !== 'writing') return
    toggleFullscreenWriting()
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        // 忽略全屏切换错误
      })
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        // 忽略全屏切换错误
      })
    }
    showToast(document.fullscreenElement ? '退出全屏' : '进入全屏', 'info')
  }, [currentInterface, toggleFullscreenWriting])

  const handleAISelectionOperation = useCallback(
    async (operation: AIOperationType) => {
      if (currentInterface !== 'writing') return
      const editor = getEditorInstance()
      if (!editor) {
        showToast('编辑器未就绪', 'warning')
        return
      }
      const selectedText = editor.state.doc.textBetween(
        editor.state.selection.from,
        editor.state.selection.to,
        ' '
      )
      await executeAIOperation(operation, selectedText)
    },
    [currentInterface]
  )

  const handleGotoInterface = useCallback(
    (target: InterfaceType) => {
      if (target === currentInterface) return
      setCurrentInterface(target)
      showToast(`已切换到${target === 'chat' ? '聊天初始化' : target === 'settings' ? '设定编辑' : '正文写作'}`, 'info')
    },
    [currentInterface, setCurrentInterface]
  )

  const handleToggleTheme = useCallback(() => {
    toggleTheme()
    const newTheme = theme === 'dark' ? '浅色' : '深色'
    showToast(`已切换至${newTheme}模式`, 'info')
  }, [toggleTheme, theme])

  const handleImmersiveMode = useCallback(() => {
    if (currentInterface !== 'writing') return
    toggleImmersiveMode()
    showToast(immersiveMode ? '退出沉浸模式' : '进入沉浸模式', 'info')
  }, [currentInterface, toggleImmersiveMode, immersiveMode])

  const handleFocusMode = useCallback(() => {
    if (currentInterface !== 'writing') return
    toggleFocusMode()
    showToast(focusModeEnabled ? '退出专注模式' : '进入专注模式', 'info')
  }, [currentInterface, toggleFocusMode, focusModeEnabled])

  const handleShowShortcutsHelp = useCallback(() => {
    // 触发自定义事件，ShortcutsHelp组件会监听
    window.dispatchEvent(new CustomEvent('show-shortcuts-help', { detail: { interface: currentInterface } }))
  }, [currentInterface])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 忽略输入框中的快捷键（除非特定组合）
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'

      // ===== 命令面板: Ctrl+K (所有界面) =====
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('toggle-command-palette'))
        return
      }

      // ===== 快捷键帮助: Ctrl+Shift+? (所有界面) =====
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '?' || e.key === '？')) {
        e.preventDefault()
        handleShowShortcutsHelp()
        return
      }

      // ===== 切换主题: Ctrl+Shift+T (所有界面) =====
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        handleToggleTheme()
        return
      }

      // ===== 界面跳转 (所有界面) =====
      if ((e.ctrlKey || e.metaKey) && e.altKey) {
        if (e.key === '1') {
          e.preventDefault()
          handleGotoInterface('chat')
          return
        }
        if (e.key === '2') {
          e.preventDefault()
          handleGotoInterface('settings')
          return
        }
        if (e.key === '3') {
          e.preventDefault()
          handleGotoInterface('writing')
          return
        }
      }

      // 以下快捷键在输入框中不触发（保存、全屏、AI操作等）
      if (isInput) {
        // 但保存和新建在输入框中仍然可用
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault()
          handleSave()
          return
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
          e.preventDefault()
          handleNewChapter()
          return
        }
        return
      }

      // ===== 保存: Ctrl+S =====
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
        return
      }

      // ===== 新建章节: Ctrl+N (写作界面) =====
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleNewChapter()
        return
      }

      // ===== 切换AI抽屉: Ctrl+\ (写作界面) =====
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault()
        if (currentInterface === 'writing') {
          toggleAIDrawer()
          showToast(aiDrawerOpen ? '关闭AI面板' : '打开AI面板', 'info')
        }
        return
      }

      // ===== 切换协作面板: Ctrl+/ (写作界面) =====
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        if (currentInterface === 'writing') {
          toggleCollaborationDrawer()
          showToast(collaborationDrawerOpen ? '关闭协作面板' : '打开协作面板', 'info')
        }
        return
      }

      // ===== 切换大纲面板: Ctrl+Shift+O (写作界面) =====
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
        e.preventDefault()
        if (currentInterface === 'writing') {
          toggleOutlineDrawer()
        }
        return
      }

      // ===== 全屏: F11 (写作界面) =====
      if (e.key === 'F11') {
        e.preventDefault()
        handleFullscreen()
        return
      }

      // ===== 沉浸模式: Ctrl+Shift+I (写作界面) =====
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        handleImmersiveMode()
        return
      }

      // ===== 专注模式: Ctrl+Shift+F (写作界面) =====
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        handleFocusMode()
        return
      }

      // ===== AI操作: Ctrl+Shift+O/E/S/R/W/P (写作界面) =====
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        const operationKey = AI_SHORTCUT_OPERATIONS[e.key]
        if (operationKey) {
          e.preventDefault()
          handleAISelectionOperation(operationKey)
          return
        }
      }
    },
    [
      currentInterface,
      aiDrawerOpen,
      collaborationDrawerOpen,
      immersiveMode,
      focusModeEnabled,
      handleSave,
      handleNewChapter,
      handleFullscreen,
      handleAISelectionOperation,
      handleGotoInterface,
      handleToggleTheme,
      handleImmersiveMode,
      handleFocusMode,
      handleShowShortcutsHelp,
      toggleAIDrawer,
      toggleCollaborationDrawer,
      toggleOutlineDrawer,
    ]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
