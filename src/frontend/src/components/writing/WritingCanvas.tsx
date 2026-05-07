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
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { FocusModeExtension, ParagraphHighlightExtension, ParagraphHighlightPluginKey } from './extensions'
import { showToast } from '@/components/ui/Toast'
import { EditorToolbar } from './EditorToolbar'
import { WritingStatsOverlay } from './WritingStatsOverlay'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { SaveStatusIndicator } from './editor/EditorArea'
import { FloatingWordCount } from './editor/FloatingWordCount'
import { EmptyStatePrompt } from './editor/EmptyStatePrompt'
import { WritingLoadingState } from './editor/WritingLoadingState'
import { ChapterTitle } from './editor/ChapterTitle'
import { StatusBar } from './editor/StatusBar'
import { TypingIndicator } from './editor/TypingIndicator'

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}分${secs > 0 ? `${secs}秒` : ''}`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}时${remainingMins > 0 ? `${remainingMins}分` : ''}`
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

  // Sync external content changes
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

  // Register editor instance for keyboard shortcuts
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

  // Auto-save - debounce 3 seconds
  const debouncedSave = useCallback(async () => {
    if (!currentChapterId || isSavingRef.current) return
    if (currentContent === lastSavedContentRef.current) return

    setSaveStatus('saving')
    isSavingRef.current = true
    try {
      await saveCurrentChapter()
      lastSavedContentRef.current = currentContent
      // Save draft version
      if (currentContent.trim()) {
        await saveDraftVersion(currentChapterId, currentContent)
      }
      markSaved()
    } catch (error) {
      console.error('Auto-save failed:', error)
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

  // Keyboard shortcut handling
  useEffect(() => {
    const handleKeyDown = (_e: KeyboardEvent) => {
      if (!editor) return
      // Ctrl+Shift+O etc. handled in Tiptap
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
      {/* Writing area - immersive paper texture with vignette and ink wash aesthetic */}
      <div
        className={`flex-1 overflow-y-auto relative writing-surface writing-surface--textured selection-warm ${focusModeEnabled ? 'vignette-overlay-strong' : 'vignette-overlay'} ${typewriterMode ? 'vignette-overlay-horizontal' : ''}`}
      >
        {/* Floating toolbar */}
        <EditorToolbar editor={editor} />

        {/* Writing card container - ink wash paper card with subtle depth */}
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

          {/* Chapter title - ink wash typography */}
          <div className="px-12 pt-12 pb-5">
            <ChapterTitle title={chapterTitle} />
          </div>

          {/* Content editor */}
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
      <FloatingWordCount wordCount={wordCount} />

      {/* Writing stats overlay */}
      <WritingStatsOverlay
        wordCount={wordCount}
        sessionWPM={sessionWPM}
        sessionDuration={sessionDuration}
        todayWordCount={todayWordCount}
        targetWordCount={targetWordCount}
      />

      {/* Bottom status bar - vintage minimal design */}
      <StatusBar
        chapterTitle={chapterTitle}
        wordCount={wordCount}
        todayWordCount={todayWordCount}
        targetWordCount={targetWordCount}
        sessionDuration={formatDuration(sessionDuration)}
        sessionWPM={sessionWPM}
        humanAIRatio={humanAIRatio}
        writingStyle={writingStyle}
        focusModeEnabled={focusModeEnabled}
        onToggleFocusMode={() => useUIStore.getState().toggleFocusMode()}
      />

      {/* Extended status bar with typing indicator and save status */}
      <div
        className="flex items-center px-5 py-2 text-xs font-medium"
        style={{
          background: 'var(--color-surface-raised)',
          borderTop: '1px solid var(--border-default)',
          color: 'var(--text-tertiary)',
          minHeight: '32px',
        }}
      >
        <div className="ml-auto flex items-center gap-3">
          {/* Auto-save indicator */}
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && <TypingIndicator isTyping={isTyping} />}
          </AnimatePresence>

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