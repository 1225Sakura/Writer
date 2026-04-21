import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { useWritingStore } from '@/store'
import { useUIStore } from '@/store'
import { setEditorInstance } from '@/store/editorRegistry'
import { useEffect, useRef, useCallback, useState } from 'react'
import { Save, CheckCircle, AlertCircle } from 'lucide-react'
import { FocusModeExtension } from './extensions'
import { EditorToolbar } from './EditorToolbar'

const WRITING_STYLE_NAMES: Record<string, string> = {
  default: '默认',
  jiangnan: '江南',
  kafka: '卡夫卡',
  camus: '加缪',
  custom: '自定义',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}分${secs > 0 ? `${secs}秒` : ''}`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}时${remainingMins > 0 ? `${remainingMins}分` : ''}`
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function SaveStatusIndicator({ status, lastSavedAt }: { status: string; lastSavedAt: number | null }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-[#d0d6e0]">
        <Save className="w-3 h-3 animate-pulse" />
        保存中...
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1 text-[#7eb84a]" title={`上次保存: ${formatTime(lastSavedAt)}`}>
        <CheckCircle className="w-3 h-3" />
        已保存 {lastSavedAt ? formatTime(lastSavedAt) : ''}
      </span>
    )
  }
  if (status === 'unsaved') {
    return (
      <span className="flex items-center gap-1 text-[#c45c5c]">
        <AlertCircle className="w-3 h-3" />
        未保存
      </span>
    )
  }
  return null
}

// FocusModeExtension is now imported from './extensions'
// EditorToolbar is now imported from './EditorToolbar'

export function WritingCanvas() {
  const {
    currentContent,
    updateContent,
    wordCount,
    currentChapterId,
    chapters,
    writingStyle,
    humanAIRatio,
    saveCurrentChapter,
    saveDraftVersion,
    loading,
    saveStatus,
    lastSavedAt,
    markSaved,
    markUnsaved,
    setSaveStatus,
    getSessionDuration,
    getSessionWPM,
    getTodayWordCount,
    targetWordCount,
  } = useWritingStore()

  const { focusModeEnabled } = useUIStore()
  const currentChapter = chapters.find((c) => c.id === currentChapterId)
  const chapterTitle = currentChapter?.title || '未选择章节'
  const isSavingRef = useRef(false)
  const lastSavedContentRef = useRef('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastWordCountRef = useRef(wordCount)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTypingRef = useRef(false)

  const [sessionDuration, setSessionDuration] = useState(0)
  const [sessionWPM, setSessionWPM] = useState(0)
  const [todayWordCount, setTodayWordCount] = useState(0)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '开始你的创作...',
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      FocusModeExtension.configure({ enabled: focusModeEnabled }),
    ],
    content: currentContent,
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      updateContent(text)
      lastWordCountRef.current = wordCount

      // Immersive mode: emit typing events
      if (!isTypingRef.current) {
        isTypingRef.current = true
        document.dispatchEvent(new CustomEvent('immersive-typing-start'))
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false
        document.dispatchEvent(new CustomEvent('immersive-typing-stop'))
      }, 1000)
    },
    editorProps: {
      attributes: {
        class: 'writing-area max-w-none focus:outline-none min-h-full px-8 py-6',
        style: 'caret-color: #e8b87d;',
      },
    },
  })

  // Apply typewriter mode scroll padding via CSS class
  useEffect(() => {
    if (editor?.view?.dom) {
      const dom = editor.view.dom
      dom.style.scrollPaddingTop = '33vh'
      dom.style.scrollPaddingBottom = '67vh'
    }
  }, [editor])

  // 同步外部内容变化
  useEffect(() => {
    if (editor && currentContent !== editor.getText()) {
      editor.commands.setContent(currentContent)
    }
  }, [currentContent, editor])

  // Sync focus mode state to extension
  useEffect(() => {
    if (editor) {
      const focusModeExt = editor.extensionManager.extensions.find(
        (ext: any) => ext.name === 'focusMode'
      )
      if (focusModeExt && focusModeExt.options) {
        focusModeExt.options.enabled = focusModeEnabled
      }
    }
  }, [focusModeEnabled, editor])

  // 注册编辑器实例供快捷键使用
  useEffect(() => {
    if (editor) {
      setEditorInstance(editor)
    }
    return () => {
      setEditorInstance(null)
    }
  }, [editor])

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  // Session stats timer - update every 5 seconds
  useEffect(() => {
    if (!currentChapterId) return
    const interval = setInterval(() => {
      setSessionDuration(getSessionDuration())
      setSessionWPM(getSessionWPM())
      setTodayWordCount(getTodayWordCount())
    }, 5000)
    return () => clearInterval(interval)
  }, [currentChapterId, getSessionDuration, getSessionWPM, getTodayWordCount])

  // 自动保存 - debounce 3秒
  const debouncedSave = useCallback(async () => {
    if (!currentChapterId || isSavingRef.current) return
    if (currentContent === lastSavedContentRef.current) return

    setSaveStatus('saving')
    isSavingRef.current = true
    try {
      await saveCurrentChapter()
      lastSavedContentRef.current = currentContent
      // 保存草稿版本
      if (currentContent.trim()) {
        await saveDraftVersion(currentChapterId, currentContent)
      }
      markSaved()
    } catch (error) {
      console.error('自动保存失败:', error)
      setSaveStatus('unsaved')
    } finally {
      isSavingRef.current = false
    }
  }, [currentChapterId, currentContent, saveCurrentChapter, saveDraftVersion, setSaveStatus, markSaved])

  useEffect(() => {
    if (currentContent !== lastSavedContentRef.current) {
      markUnsaved()
    }
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(debouncedSave, 3000)
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [currentContent, debouncedSave, markUnsaved])

  // 快捷键处理
  useEffect(() => {
    const handleKeyDown = (_e: KeyboardEvent) => {
      if (!editor) return
      // Ctrl+Shift+O 等快捷键在 Tiptap 中处理
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editor])

  return (
    <div className="h-full flex flex-col bg-[var(--color-writing-dark)]">
      {/* 写作区域 - subtle paper texture background */}
      <div className="flex-1 overflow-y-auto relative"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(94, 106, 210, 0.03) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(232, 184, 125, 0.02) 0%, transparent 50%),
            linear-gradient(180deg, rgba(255,255,255,0.01) 0%, transparent 30%, rgba(0,0,0,0.02) 100%)
          `,
        }}
      >
        {/* 浮动工具栏 */}
        <EditorToolbar editor={editor} />

        {/* 卡片化容器 - Linear elevation-2 with semi-transparent border */}
        <div className="mx-8 my-6 rounded-xl" style={{
          backgroundColor: 'rgba(245, 240, 230, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(8px)',
        }}>
          {/* 章节标题 - 与正文融合过渡 */}
          <div className="px-12 pt-10 pb-4">
            <h1
              className="font-serif text-2xl font-medium tracking-tight text-[var(--color-text-writing)]"
              style={{
                lineHeight: 1.85,
                letterSpacing: '-0.02em',
                transition: 'color var(--transition-normal)',
              }}
            >
              {chapterTitle}
            </h1>
            {/* 柔和分隔线 - Linear semi-transparent style */}
            <div className="mt-4 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.08)] to-transparent" />
          </div>

          {/* 正文编辑器 */}
          <EditorContent
            editor={editor}
            className="min-h-full px-12 pb-12"
          />
        </div>
      </div>

      {/* 底部状态栏 - refined visual design */}
      <div
        className="flex items-center px-5 py-2 text-xs font-medium"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderTop: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-sans)',
          minHeight: '36px',
          gap: '2px',
        }}
      >
        <span className="px-2 py-0.5 rounded-md" style={{ color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.03)' }}>
          {chapterTitle}
        </span>
        <span className="mx-1.5 opacity-20">|</span>
        <span className="px-1.5">{wordCount} 字</span>
        <span className="mx-1.5 opacity-20">|</span>
        <span className="px-1.5">今日: {todayWordCount} / {targetWordCount} 字</span>
        <span className="mx-1.5 opacity-20">|</span>
        <span className="px-1.5">时长: {formatDuration(sessionDuration)}</span>
        <span className="mx-1.5 opacity-20">|</span>
        <span className="px-1.5">速度: {sessionWPM} 字/分</span>
        <span className="mx-1.5 opacity-20">|</span>
        <span className="px-1.5">人机比例: {humanAIRatio}%</span>
        <span className="mx-1.5 opacity-20">|</span>
        <span className="px-1.5" style={{ color: 'var(--color-character)' }}>文笔: {WRITING_STYLE_NAMES[writingStyle] || writingStyle}</span>
        <span className="mx-1.5 opacity-20">|</span>
        <button
          onClick={() => useUIStore.getState().toggleFocusMode()}
          className={`px-2 py-0.5 rounded-md text-xs transition-all duration-200 ${
            focusModeEnabled
              ? 'bg-[var(--color-outline)]/15 text-[var(--color-outline)]'
              : 'hover:bg-[rgba(255,255,255,0.06)] text-[var(--color-text-muted)]'
          }`}
          title="聚焦模式 (Ctrl+Shift+F)"
        >
          {focusModeEnabled ? '聚焦中' : '聚焦'}
        </button>

        <div className="ml-auto flex items-center gap-3">
          {/* Auto-save indicator */}
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />

          {loading.ai && (
            <span className="flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
              AI处理中...
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
