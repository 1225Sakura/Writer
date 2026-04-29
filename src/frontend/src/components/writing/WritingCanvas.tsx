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
import { Save, CheckCircle, AlertCircle, Feather, Keyboard, Loader2 } from 'lucide-react'
import { FocusModeExtension, ParagraphHighlightExtension, ParagraphHighlightPluginKey } from './extensions'
import { showToast } from '@/components/ui/Toast'
import { EditorToolbar } from './EditorToolbar'
import { WritingStatsOverlay } from './WritingStatsOverlay'
import { Type } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


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

/** Refined floating word count pill with subtle glow */
function FloatingWordCount({ wordCount, isTyping }: { wordCount: number; isTyping: boolean }) {
  return (
    <motion.div
      className="word-count-pill word-count-pill--floating"
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <motion.span
        className="word-count-pill__number"
        key={wordCount}
        initial={{ scale: 1.15, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
      >
        {wordCount}
      </motion.span>
      <span className="word-count-pill__label">字</span>
      <AnimatePresence>
        {isTyping && (
          <motion.span
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'var(--color-ifline)',
              boxShadow: '0 0 4px color-mix(in srgb, var(--color-ifline) 50%, transparent)',
            }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** Elegant empty state prompt with refined animations */
function EmptyStatePrompt({ onStart }: { onStart?: () => void }) {
  return (
    <motion.div
      className="writing-empty-state"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      <motion.div
        className="writing-empty-state__icon"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        <Feather className="w-5 h-5" />
      </motion.div>
      <motion.h3
        className="writing-empty-state__title"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        开始你的创作
      </motion.h3>
      <motion.p
        className="writing-empty-state__hint"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        点击此处开始写作，或使用快捷键 Ctrl+Shift+W 续写
      </motion.p>
      <motion.button
        className="mt-5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200"
        style={{
          background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
          color: 'var(--accent-primary)',
        }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
        whileHover={{
          scale: 1.03,
          background: 'color-mix(in srgb, var(--accent-primary) 18%, transparent)',
        }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
      >
        开始写作
      </motion.button>
      <motion.div
        className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg"
        style={{
          background: 'color-mix(in srgb, var(--color-surface-raised) 60%, transparent)',
          border: '1px solid var(--border-subtle)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <Keyboard className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          Ctrl+Shift+O 优化 / E 扩写 / S 缩写 / R 改写 / W 续写 / P 润色
        </span>
      </motion.div>
    </motion.div>
  )
}

/** Refined loading state with multi-layer animation */
function WritingLoadingState() {
  return (
    <motion.div
      className="writing-loading flex items-center justify-center min-h-[300px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-10 h-10">
          {/* Outer ring */}
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{
              border: '1.5px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)',
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
          {/* Inner gradient orb */}
          <motion.div
            className="absolute inset-1.5 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 25%, transparent), color-mix(in srgb, var(--color-character) 18%, transparent))',
              boxShadow: '0 0 12px color-mix(in srgb, var(--accent-primary) 15%, transparent)',
            }}
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.6, 0.9, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          {/* Center dot */}
          <motion.div
            className="absolute inset-[15px] rounded-sm"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 60%, transparent)',
            }}
            animate={{
              scale: [1, 0.8, 1],
              opacity: [0.8, 0.4, 0.8],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>
        <motion.span
          className="text-xs font-medium tracking-wide"
          style={{ color: 'var(--text-tertiary)' }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          正在准备创作空间...
        </motion.span>
      </div>
    </motion.div>
  )
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
    runAllChecks,
    clearCheckerResults,
    error: storeError,
  } = useWritingStore()

  const { focusModeEnabled, typewriterMode, paragraphFocusMode, paperEdgeDecoration } = useUIStore()
  const currentChapter = chapters.find((c) => c.id === currentChapterId)
  const chapterTitle = currentChapter?.title || '未选择章节'
  const isSavingRef = useRef(false)
  const lastSavedContentRef = useRef('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastWordCountRef = useRef(wordCount)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTypingRef = useRef(false)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  const [sessionDuration, setSessionDuration] = useState(0)
  const [sessionWPM, setSessionWPM] = useState(0)
  const [todayWordCount, setTodayWordCount] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isEmpty, setIsEmpty] = useState(!currentContent?.trim())
  const typingIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Simulate loading on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400)
    return () => clearTimeout(timer)
  }, [])

  // Track empty state
  useEffect(() => {
    setIsEmpty(!currentContent?.trim())
  }, [currentContent])

  // Run AI checks when chapter changes
  useEffect(() => {
    if (currentChapterId) {
      clearCheckerResults()
      // Run checks in background (fire and forget)
      runAllChecks(currentChapterId).catch((err) => {
        console.warn('Background checks failed:', err)
      })
    }
  }, [currentChapterId, runAllChecks, clearCheckerResults])

  // Show error toast when store error changes
  useEffect(() => {
    if (storeError) {
      showToast(storeError, 'error')
    }
  }, [storeError])

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
      ParagraphHighlightExtension.configure({
        enabled: paragraphFocusMode,
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
    onSelectionUpdate: ({ editor }) => {
      // Track current paragraph for paragraph focus mode via plugin dispatch
      if (paragraphFocusMode) {
        const { from } = editor.state.selection
        editor.view.dispatch(
          editor.view.state.tr.setMeta(ParagraphHighlightPluginKey, from)
        )
      }
    },
    editorProps: {
      attributes: {
        class: 'writing-area max-w-none focus:outline-none min-h-full px-8 py-6 immersive-canvas chinese-paragraphs cjk-punctuation-hang typewriter-caret-glow',
        style: 'caret-color: var(--paper-85); --glow-primary: var(--color-character);',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': '写作区',
      },
    },
  })

  // Apply typewriter mode scroll padding via CSS class
  useEffect(() => {
    if (editor?.view?.dom) {
      const dom = editor.view.dom
      if (typewriterMode) {
        dom.style.scrollPaddingTop = '45vh'
        dom.style.scrollPaddingBottom = '45vh'
      } else {
        dom.style.scrollPaddingTop = '33vh'
        dom.style.scrollPaddingBottom = '67vh'
      }
    }
  }, [editor, typewriterMode])

  // Sync paragraph focus mode class on container
  useEffect(() => {
    const container = editorContainerRef.current
    if (!container) return
    if (paragraphFocusMode) {
      container.classList.add('paragraph-focus-mode')
    } else {
      container.classList.remove('paragraph-focus-mode')
      // Clean up: dispatch null to clear plugin state
      if (editor) {
        editor.view.dispatch(editor.view.state.tr.setMeta(ParagraphHighlightPluginKey, null))
      }
    }
  }, [paragraphFocusMode, editor])

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
        // Trigger re-decoration via empty transaction instead of updateState
        editor.view.dispatch(editor.view.state.tr)
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
    <div
      ref={editorContainerRef}
      className={`h-full flex flex-col ${typewriterMode ? 'typewriter-mode' : ''}`}
      style={{ backgroundColor: 'var(--writing-bg)' }}
    >
      {/* 写作区域 - immersive paper texture with vignette and ink wash aesthetic */}
      <div
        className={`flex-1 overflow-y-auto relative writing-surface writing-surface--textured selection-warm ${focusModeEnabled ? 'vignette-overlay-strong' : 'vignette-overlay'} ${typewriterMode ? 'vignette-overlay-horizontal' : ''}`}
      >
        {/* 浮动工具栏 */}
        <EditorToolbar editor={editor} />

        {/* 写作卡片容器 - ink wash paper card with subtle depth */}
        <div
          className={`my-8 rounded-2xl max-w-[var(--writing-max-width)] mx-auto writing-card relative ink-texture
            ${paperEdgeDecoration ? 'writing-card--paper-edge' : ''}`}
          style={{
            backgroundColor: 'var(--writing-bg)',
            boxShadow: `
              0 1px 2px color-mix(in srgb, var(--ink-100) 5%, transparent),
              0 4px 12px color-mix(in srgb, var(--ink-100) 4%, transparent),
              0 12px 32px color-mix(in srgb, var(--ink-100) 3%, transparent),
              inset 0 1px 0 color-mix(in srgb, var(--paper-100) 10%, transparent)
            `,
          }}
        >
          {/* Paper edge highlight - ink wash gleam */}
          <div
            className="absolute top-0 left-6 right-6 h-px pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--paper-100) 15%, transparent) 25%, color-mix(in srgb, var(--paper-100) 20%, transparent) 50%, color-mix(in srgb, var(--paper-100) 15%, transparent) 75%, transparent 100%)',
            }}
          />

          {/* 章节标题 - ink wash typography */}
          <div className="px-12 pt-12 pb-5">
            <motion.h1
              className="font-serif-cn text-2xl font-semibold tracking-tight cjk-punctuation-hang"
              style={{
                color: 'var(--writing-text)',
                lineHeight: 'var(--leading-tight)',
                letterSpacing: 'var(--tracking-tight)',
                transition: 'color var(--transition-normal)',
                fontFamily: 'var(--font-serif-cn)',
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
            >
              {chapterTitle}
            </motion.h1>
            {/* Ink wash underline decoration */}
            <motion.div
              className="mt-5 flex items-center gap-2"
              initial={{ opacity: 0, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: DURATION.SLOW, delay: 0.1, ease: EASE.SMOOTH }}
            >
              <div className="h-px flex-1 ink-divider" />
              <div
                className="w-8 h-[2px] rounded-full"
                style={{
                  background: 'linear-gradient(90deg, color-mix(in srgb, var(--color-character) 40%, transparent), color-mix(in srgb, var(--color-vermillion) 40%, transparent))',
                  boxShadow: '0 0 6px color-mix(in srgb, var(--color-character) 15%, transparent)',
                }}
              />
              <div className="h-px flex-1 ink-divider" />
            </motion.div>
          </div>

          {/* 正文编辑器 */}
          <div className="min-h-full px-12 pb-16 relative">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <WritingLoadingState key="loading" />
              ) : isEmpty && !currentContent?.trim() ? (
                <EmptyStatePrompt
                  key="empty"
                  onStart={() => editor?.commands.focus('end')}
                />
              ) : (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
                >
                  <EditorContent editor={editor} id="editor-content" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Floating word count pill */}
      <FloatingWordCount wordCount={wordCount} isTyping={isTyping} />

      {/* 写作统计悬浮组件 */}
      <WritingStatsOverlay
        wordCount={wordCount}
        sessionWPM={sessionWPM}
        sessionDuration={sessionDuration}
        todayWordCount={todayWordCount}
        targetWordCount={targetWordCount}
      />

      {/* 底部状态栏 - glass-ink minimal design */}
      <div
        className="flex items-center px-5 py-2 text-xs font-medium glass-ink"
        style={{
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
            background: 'color-mix(in srgb, var(--color-outline) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-outline) 20%, transparent)',
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
                background: 'color-mix(in srgb, var(--color-ifline) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-ifline) 12%, transparent)',
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

          {loading.checkers && (
            <span className="flex items-center gap-1" style={{ color: 'var(--color-outline)' }}>
              <Loader2 className="w-3 h-3 animate-spin motion-reduce:animate-none" />
              检查中...
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
