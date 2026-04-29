import { useEffect, useCallback } from 'react'
import { useUIStore, useWritingStore } from '@/store'
import { getEditorInstance } from '@/store/editorRegistry'
import {
  AI_SHORTCUT_OPERATIONS,
  AI_OPERATION_LABELS,
  type AIOperationType,
} from '@/constants/shortcuts'
import type { InterfaceType } from '@/store/uiStore'
import { showToast } from '@/components/ui/Toast'

/**
 * 执行AI操作并显示Toast通知
 */
async function executeAIOperation(operation: AIOperationType, selectedText: string) {
  if (!selectedText.trim()) {
    showToast('请先选中要处理的文本', 'warning')
    return
  }

  const label = AI_OPERATION_LABELS[operation]
  showToast(`正在${label}...`, 'info')

  try {
    // 获取writing store中的AI操作方法
    const store = useWritingStore.getState()
    let result: string

    switch (operation) {
      case 'optimize':
        result = await store.optimize(selectedText)
        break
      case 'expand':
        result = await store.expand(selectedText)
        break
      case 'condense':
        result = await store.condense(selectedText)
        break
      case 'rewrite':
        result = await store.rewrite(selectedText)
        break
      case 'continue':
        result = await store.continue(selectedText)
        break
      case 'polish':
        result = await store.polish(selectedText)
        break
      default:
        throw new Error(`未知AI操作: ${operation}`)
    }

    // 将结果插入编辑器（替换选中文本）
    const editor = getEditorInstance()
    if (editor && result) {
      editor
        .chain()
        .focus()
        .insertContentAt(editor.state.selection, result)
        .run()
    }

    showToast(`${label}完成`, 'success')
  } catch (error) {
    showToast(`${label}失败: ${(error as Error).message}`, 'error')
  }
}

/**
 * 全局快捷键管理器 Hook
 * 处理所有界面的全局快捷键
 */
export function useGlobalShortcuts() {
  // Use selectors to only subscribe to needed state slices
  const currentInterface = useUIStore((state) => state.currentInterface)
  const aiDrawerOpen = useUIStore((state) => state.aiDrawerOpen)
  const collaborationDrawerOpen = useUIStore((state) => state.collaborationDrawerOpen)
  const immersiveMode = useUIStore((state) => state.immersiveMode)
  const focusModeEnabled = useUIStore((state) => state.focusModeEnabled)
  const theme = useUIStore((state) => state.theme)

  const toggleAIDrawer = useUIStore((state) => state.toggleAIDrawer)
  const toggleCollaborationDrawer = useUIStore((state) => state.toggleCollaborationDrawer)
  const toggleOutlineDrawer = useUIStore((state) => state.toggleOutlineDrawer)
  const toggleFullscreenWriting = useUIStore((state) => state.toggleFullscreenWriting)
  const toggleImmersiveMode = useUIStore((state) => state.toggleImmersiveMode)
  const toggleFocusMode = useUIStore((state) => state.toggleFocusMode)
  const toggleTheme = useUIStore((state) => state.toggleTheme)
  const setCurrentInterface = useUIStore((state) => state.setCurrentInterface)

  const currentChapterId = useWritingStore((state) => state.currentChapterId)
  const saveCurrentChapter = useWritingStore((state) => state.saveCurrentChapter)
  const createChapter = useWritingStore((state) => state.createChapter)
  const markSaved = useWritingStore((state) => state.markSaved)

  // ===== 保存功能 =====
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

  // ===== 新建章节 =====
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

  // ===== 全屏切换 =====
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

  // ===== AI选中操作 =====
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

  // ===== 界面跳转 =====
  const handleGotoInterface = useCallback(
    (target: InterfaceType) => {
      if (target === currentInterface) return
      setCurrentInterface(target)
      showToast(`已切换到${target === 'chat' ? '聊天初始化' : target === 'settings' ? '设定编辑' : '正文写作'}`, 'info')
    },
    [currentInterface, setCurrentInterface]
  )

  // ===== 切换主题 =====
  const handleToggleTheme = useCallback(() => {
    toggleTheme()
    const newTheme = theme === 'dark' ? '浅色' : '深色'
    showToast(`已切换至${newTheme}模式`, 'info')
  }, [toggleTheme, theme])

  // ===== 沉浸模式 =====
  const handleImmersiveMode = useCallback(() => {
    if (currentInterface !== 'writing') return
    toggleImmersiveMode()
    showToast(immersiveMode ? '退出沉浸模式' : '进入沉浸模式', 'info')
  }, [currentInterface, toggleImmersiveMode, immersiveMode])

  // ===== 专注模式 =====
  const handleFocusMode = useCallback(() => {
    if (currentInterface !== 'writing') return
    toggleFocusMode()
    showToast(focusModeEnabled ? '退出专注模式' : '进入专注模式', 'info')
  }, [currentInterface, toggleFocusMode, focusModeEnabled])

  // ===== 显示快捷键帮助 =====
  const handleShowShortcutsHelp = useCallback(() => {
    // 触发自定义事件，ShortcutsHelp组件会监听
    window.dispatchEvent(new CustomEvent('show-shortcuts-help', { detail: { interface: currentInterface } }))
  }, [currentInterface])

  // ===== 主键盘事件处理 =====
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

/**
 * 快捷键管理器组件
 * 在 App 层级挂载，管理所有全局快捷键
 */
export function ShortcutManager() {
  useGlobalShortcuts()
  return null
}

/**
 * 获取当前界面可用的快捷键提示文本
 */
export function getShortcutsHelpText(interfaceType: InterfaceType): string {
  const shortcuts: Record<string, string[]> = {
    global: [
      'Ctrl+K: 命令面板',
      'Ctrl+Shift+T: 切换主题',
      'Ctrl+Shift+?: 快捷键帮助',
    ],
    navigation: [
      'Ctrl+Alt+1: 聊天初始化',
      'Ctrl+Alt+2: 设定编辑',
      'Ctrl+Alt+3: 正文写作',
    ],
    writing: [
      'Ctrl+S: 保存',
      'Ctrl+N: 新建章节',
      'Ctrl+\\: 切换AI面板',
      'Ctrl+/: 切换协作面板',
      'Ctrl+Shift+O: 切换大纲面板',
      'F11: 全屏写作',
      'Ctrl+Shift+I: 沉浸模式',
      'Ctrl+Shift+F: 专注模式',
      'Ctrl+Shift+O: AI优化',
      'Ctrl+Shift+E: AI扩写',
      'Ctrl+Shift+S: AI缩写',
      'Ctrl+Shift+R: AI改写',
      'Ctrl+Shift+W: AI续写',
      'Ctrl+Shift+P: AI润色',
    ],
  }

  const lines: string[] = []
  lines.push(...shortcuts.global)
  lines.push(...shortcuts.navigation)
  if (interfaceType === 'writing') {
    lines.push(...shortcuts.writing)
  }
  return lines.join('\n')
}
