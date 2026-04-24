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
import { usePrefersReducedMotion } from '@/hooks'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, CheckCircle, AlertCircle } from 'lucide-react'
import { FocusModeExtension } from './extensions'
import { EditorToolbar } from './EditorToolbar'
import { WritingStatsOverlay } from './WritingStatsOverlay'
import { Type } from 'lucide-react'

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
      <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
        <Save className="w-3 h-3 animate-pulse motion-reduce:animate-none" />
        保存中...
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1" style={{ color: 'var(--color-ifline)' }} title={`上次保存: ${formatTime(lastSavedAt)}`}>
        <CheckCircle className="w-3 h-3" />
        已保存 {lastSavedAt ? formatTime(lastSavedAt) : ''}
      </span>
    )
  }
  if (status === 'unsaved') {
    return (
      <span className="flex items-center gap-1" style={{ color: 'var(--color-vermillion)' }}>
        <AlertCircle className="w-3 h-3" />
        未保存
      </span>
    )
  }
  return null
}

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
  const [isTyping, setIsTyping] = useState(false)
  const typingIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
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
      FocusModeExtension.configure({
        enabled: focusModeEnabled,
        dimOpacity: 0.22,
        blurAmount: 0.3,
        focusRange: 'paragraph',
        fadeInDuration: 500,
        keepHeadingsVisible: true,
        keepEmptyLinesVisible: false,
      }),
    ],
    content: currentContent,
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      updateContent(text)
      lastWordCountRef.current = wordCount

      // Typing indicator
      setIsTyping(true)
      if (typingIndicatorTimeoutRef.current) {
        clearTimeout(typingIndicatorTimeoutRef.current)
      }
      typingIndicatorTimeoutRef.current = setTimeout(() => {
        setIsTyping(false)
      }, 1500)

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
        class: 'writing-area max-w-none focus:outline-none min-h-full px-8 py-6 immersive-canvas',
        style: 'caret-color: var(--color-character);',
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
        // Trigger re-decoration
        editor.view.updateState(editor.view.state)
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
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--writing-bg)' }}>
      {/* 写作区域 - enhanced paper texture with layered gradients */}
      <div
        className="flex-1 overflow-y-auto relative writing-surface"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--accent-primary) 2%, transparent) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 100%, color-mix(in srgb, var(--color-character) 1.5%, transparent) 0%, transparent 55%),
            radial-gradient(ellipse 50% 35% at 10% 60%, color-mix(in srgb, var(--color-outline) 1%, transparent) 0%, transparent 45%),
            radial-gradient(ellipse 100% 60% at 50% 100%, color-mix(in srgb, var(--ink-100) 2%, transparent) 0%, transparent 80%),
            linear-gradient(180deg, color-mix(in srgb, var(--paper-100) 0.5%, transparent) 0%, transparent 20%, color-mix(in srgb, var(--ink-100) 1.5%, transparent) 100%)
          `,
        }}
      >
        {/* 浮动工具栏 */}
        <EditorToolbar editor={editor} />

        {/* 写作卡片容器 - enhanced with refined shadow and subtle glow */}
        <div
          className="my-8 rounded-2xl max-w-[var(--writing-max-width)] mx-auto writing-card paper-texture relative"
          style={{
            backgroundColor: 'var(--writing-bg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: `
              0 2px 8px color-mix(in srgb, var(--ink-100) 10%, transparent),
              0 8px 24px color-mix(in srgb, var(--ink-100) 8%, transparent),
              0 16px 48px color-mix(in srgb, var(--ink-100) 5%, transparent),
              inset 0 1px 0 var(--border-subtle),
              inset 0 -1px 0 color-mix(in srgb, var(--paper-100) 20%, transparent)
            `,
          }}
        >
          {/* Subtle inner glow at top */}
          <div
            className="absolute inset-x-8 top-0 h-px rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-character) 15%, transparent) 50%, transparent)',
              boxShadow: '0 0 12px color-mix(in srgb, var(--color-character) 10%, transparent)',
            }}
          />

          {/* 章节标题 - refined with subtle text shadow */}
          <div className="px-12 pt-12 pb-5">
            <h1
              className="font-serif-cn text-2xl font-semibold tracking-tight"
              style={{
                color: 'var(--writing-text)',
                lineHeight: 'var(--leading-tight)',
                letterSpacing: 'var(--tracking-tight)',
                transition: 'color var(--transition-normal)',
                fontFamily: 'var(--font-serif-cn)',
                textShadow: '0 1px 3px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
              }}
            >
              {chapterTitle}
            </h1>
            {/* Refined underline decoration with gradient */}
            <div className="mt-5 flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent opacity-40" />
              <div
                className="w-10 h-[2px] rounded-full"
                style={{
                  background: 'linear-gradient(90deg, color-mix(in srgb, var(--color-character) 50%, transparent), color-mix(in srgb, var(--color-vermillion) 50%, transparent))',
                  boxShadow: '0 0 8px color-mix(in srgb, var(--color-character) 30%, transparent)',
                }}
              />
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent opacity-40" />
            </div>
          </div>

          {/* 正文编辑器 */}
          <EditorContent editor={editor} className="min-h-full px-12 pb-16" />
        </div>
      </div>

      {/* 写作统计悬浮组件 */}
      <WritingStatsOverlay
        wordCount={wordCount}
        sessionWPM={sessionWPM}
        sessionDuration={sessionDuration}
        todayWordCount={todayWordCount}
        targetWordCount={targetWordCount}
      />

      {/* 底部状态栏 - refined visual design using CSS variables */}
      <div
        className="flex items-center px-5 py-2 text-xs font-medium"
        style={{
          background: 'linear-gradient(180deg, var(--color-surface-base) 0%, rgba(13, 13, 18, 0.98) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-sans)',
          minHeight: '36px',
          gap: '2px',
        }}
      >
        <span
          className="px-2 py-0.5 rounded-md"
          style={{
            color: 'var(--text-secondary)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {chapterTitle}
        </span>
        <span className="mx-1.5 opacity-15">|</span>
        <span className="px-1.5">{wordCount} 字</span>
        <span className="mx-1.5 opacity-15">|</span>
        <span className="px-1.5">
          今日: {todayWordCount} / {targetWordCount} 字
        </span>
        <span className="mx-1.5 opacity-15">|</span>
        <span className="px-1.5">时长: {formatDuration(sessionDuration)}</span>
        <span className="mx-1.5 opacity-15">|</span>
        <span className="px-1.5">速度: {sessionWPM} 字/分</span>
        <span className="mx-1.5 opacity-15">|</span>
        <span className="px-1.5">人机比例: {humanAIRatio}%</span>
        <span className="mx-1.5 opacity-15">|</span>
        <span className="px-1.5" style={{ color: 'var(--color-character)' }}>
          文笔: {WRITING_STYLE_NAMES[writingStyle] || writingStyle}
        </span>
        <span className="mx-1.5 opacity-15">|</span>
        <button
          onClick={() => useUIStore.getState().toggleFocusMode()}
          className={`px-2 py-0.5 rounded-md text-xs transition-all duration-200 ${
            focusModeEnabled
              ? 'text-[var(--color-outline)]'
              : 'text-[var(--text-tertiary)]'
          }`}
          style={focusModeEnabled ? {
            background: 'rgba(91, 142, 232, 0.12)',
            border: '1px solid rgba(91, 142, 232, 0.2)',
          } : {
            border: '1px solid transparent',
          }}
          onMouseEnter={(e) => {
            if (!focusModeEnabled) {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
            }
          }}
          onMouseLeave={(e) => {
            if (!focusModeEnabled) {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
            }
          }}
          title="聚焦模式 (Ctrl+Shift+F)"
        >
          {focusModeEnabled ? '聚焦中' : '聚焦'}
        </button>

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md"
              style={{
                background: 'rgba(126, 184, 74, 0.06)',
                border: '1px solid rgba(126, 184, 74, 0.12)',
              }}
            >
              <motion.div
                animate={prefersReducedMotion ? {} : { opacity: [1, 0.3, 1] }}
                transition={prefersReducedMotion ? {} : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Type className="w-3 h-3" style={{ color: 'var(--color-ifline)' }} />
              </motion.div>
              <span className="text-[10px] font-medium" style={{ color: 'var(--color-ifline)' }}>写作中</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="ml-auto flex items-center gap-3">
          {/* Auto-save indicator */}
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />

          {loading.ai && (
            <span className="flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse motion-reduce:animate-none" style={{ backgroundColor: 'var(--accent-primary)' }} />
              AI处理中...
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
