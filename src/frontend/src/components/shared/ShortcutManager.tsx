import { useEffect, useCallback } from 'react'
import { useUIStore, useWritingStore } from '@/store'
import { getEditorInstance } from '@/store/editorRegistry'
import { KEYBOARD_SHORTCUTS, AI_SHORTCUT_OPERATIONS, AI_OPERATION_LABELS, AIOperationType } from '@/constants/shortcuts'

/**
 * 执行AI操作（目前仅记录日志，实际API调用待实现）
 */
function executeAIOperation(operation: AIOperationType, selectedText: string) {
  console.log(`[AI操作] ${AI_OPERATION_LABELS[operation]}:`, selectedText || '(无选中文字)')
  // TODO: 调用实际AI API
}

/**
 * 全局快捷键管理器
 * 处理 Ctrl+\、Ctrl+/、Ctrl+S 等全局快捷键
 */
export function useGlobalShortcuts() {
  const {
    toggleAIDrawer,
    toggleCollaborationDrawer,
    toggleFullscreenWriting,
    currentInterface,
  } = useUIStore()
  const { currentChapterId, saveCurrentChapter } = useWritingStore()

  // 保存功能
  const handleSave = useCallback(() => {
    if (!currentChapterId) {
      console.log('[保存] 无活动章节')
      return
    }
    saveCurrentChapter()
    console.log('[保存] 章节已保存:', currentChapterId)
  }, [currentChapterId, saveCurrentChapter])

  // 全屏切换
  const handleFullscreen = useCallback(() => {
    toggleFullscreenWriting()
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }, [toggleFullscreenWriting])

  // AI选中操作
  const handleAISelectionOperation = useCallback((operation: AIOperationType) => {
    const editor = getEditorInstance()
    if (!editor) {
      console.log('[AI操作] 编辑器未就绪')
      return
    }
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    )
    executeAIOperation(operation, selectedText)
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 仅在writing界面生效
      if (currentInterface !== 'writing') return

      const { TOGGLE_AI_DRAWER, TOGGLE_COLLABORATION, SAVE, FULLSCREEN } = KEYBOARD_SHORTCUTS

      // Ctrl+\ 切换 AI 抽屉
      if (e.ctrlKey && e.key === TOGGLE_AI_DRAWER.key) {
        e.preventDefault()
        toggleAIDrawer()
        return
      }

      // Ctrl+/ 切换协作面板
      if (e.ctrlKey && e.key === TOGGLE_COLLABORATION.key) {
        e.preventDefault()
        toggleCollaborationDrawer()
        return
      }

      // Ctrl+S 保存
      if (e.ctrlKey && e.key === SAVE.key) {
        e.preventDefault()
        handleSave()
        return
      }

      // F11 全屏写作
      if (e.key === FULLSCREEN.key) {
        e.preventDefault()
        handleFullscreen()
        return
      }

      // Ctrl+Shift+O/E/S/R/W/P AI操作
      if (e.ctrlKey && e.shiftKey) {
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
      toggleAIDrawer,
      toggleCollaborationDrawer,
      handleSave,
      handleFullscreen,
      handleAISelectionOperation,
    ]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * 快捷键管理器组件
 * 在 App 层级挂载
 */
export function ShortcutManager() {
  useGlobalShortcuts()
  return null
}
