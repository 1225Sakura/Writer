/**
 * useWritingEditor - Custom hook for Tiptap editor setup and effects
 *
 * Encapsulates editor initialization, content sync, focus mode,
 * auto-save, typing indicators, and session stats tracking.
 */

import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { useWritingStore, useContentStore, useAIStore, useCheckerStore, useUIStore } from '@/store'
import { setEditorInstance } from '@/store/editorRegistry'
import { useEffect, useRef, useCallback, useState } from 'react'
import { showToast } from '@/components/ui/Toast'
import { FocusModeExtension, ParagraphHighlightExtension, ParagraphHighlightPluginKey, InlineAIExtension, StyleCheckExtension } from './extensions'
import { GhostTextExtension } from './ai/GhostTextExtension'

export function useWritingEditor() {
  const {
    currentContent,
    updateContent,
    wordCount,
    currentChapterId,
    writingStyle,
    humanAIRatio,
    saveCurrentChapter,
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
  const { chapters, saveDraftVersion } = useContentStore()
  const { loading: aiLoading } = useAIStore()
  const { runAllChecks, clearCheckerResults, error: storeError, loading: checkerLoading } = useCheckerStore()

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
      runAllChecks(currentChapterId).catch(() => {
        // Background check failure handled by store
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
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: '开始你的创作...' }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      FocusModeExtension.configure({
        enabled: focusModeEnabled,
        dimOpacity: 0.22,
        blurAmount: 0.3,
        focusRange: focusModeEnabled
          ? (paragraphFocusMode ? 'paragraph+sentence' : 'sentence')
          : 'paragraph',
        fadeInDuration: 500,
        keepHeadingsVisible: true,
        keepEmptyLinesVisible: false,
      }),
      ParagraphHighlightExtension.configure({ enabled: paragraphFocusMode }),
      InlineAIExtension,
      StyleCheckExtension.configure({
        enabled: true,
        debounceMs: 2000,
      }),
      GhostTextExtension.configure({
        // Phase 3 E.1: snappy 200ms debounce so suggestions feel
        // conversational, not laggy. Backend rate-limits per chapter so
        // cost is bounded.
        debounceMs: 200,
      }),
    ],
    content: currentContent,
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      updateContent(text)
      lastWordCountRef.current = wordCount

      setIsTyping(true)
      if (typingIndicatorTimeoutRef.current) clearTimeout(typingIndicatorTimeoutRef.current)
      typingIndicatorTimeoutRef.current = setTimeout(() => setIsTyping(false), 1500)

      if (!isTypingRef.current) {
        isTypingRef.current = true
        document.dispatchEvent(new CustomEvent('immersive-typing-start'))
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false
        document.dispatchEvent(new CustomEvent('immersive-typing-stop'))
      }, 1000)
    },
    onSelectionUpdate: ({ editor }) => {
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

  // Apply typewriter mode scroll behavior
  useEffect(() => {
    if (editor?.view?.dom) {
      const dom = editor.view.dom
      if (typewriterMode) {
        dom.style.scrollPaddingTop = '38vh'
        dom.style.scrollPaddingBottom = '62vh'
      } else {
        dom.style.scrollPaddingTop = '33vh'
        dom.style.scrollPaddingBottom = '67vh'
      }
    }
  }, [editor, typewriterMode])

  // Typewriter scroll: keep cursor at ~38% viewport height after each update
  useEffect(() => {
    if (!editor || !typewriterMode) return

    const scrollToCursor = () => {
      requestAnimationFrame(() => {
        const { from } = editor.state.selection
        const coords = editor.view.coordsAtPos(from)
        if (!coords) return

        const editorDom = editor.view.dom
        const editorRect = editorDom.getBoundingClientRect()
        const scrollContainer = editorDom.closest('.tiptap')?.parentElement || editorDom.parentElement
        if (!scrollContainer) return

        const cursorY = coords.top - editorRect.top + scrollContainer.scrollTop
        const targetScroll = cursorY - scrollContainer.clientHeight * 0.38
        scrollContainer.scrollTo({ top: targetScroll, behavior: 'smooth' })
      })
    }

    // Listen for selection updates and content changes
    editor.on('selectionUpdate', scrollToCursor)
    editor.on('update', scrollToCursor)

    return () => {
      editor.off('selectionUpdate', scrollToCursor)
      editor.off('update', scrollToCursor)
    }
  }, [editor, typewriterMode])

  // Sync paragraph focus mode
  useEffect(() => {
    const container = editorContainerRef.current
    if (!container) return
    if (paragraphFocusMode) {
      container.classList.add('paragraph-focus-mode')
    } else {
      container.classList.remove('paragraph-focus-mode')
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

  // Sync focus mode state and options to extension
  useEffect(() => {
    if (editor) {
      const focusModeExt = editor.extensionManager.extensions.find(
        (ext) => ext.name === 'focusMode'
      )
      if (focusModeExt && focusModeExt.options) {
        const derivedFocusRange = focusModeEnabled
          ? (paragraphFocusMode ? 'paragraph+sentence' : 'sentence')
          : 'paragraph'
        focusModeExt.options.enabled = focusModeEnabled
        focusModeExt.options.focusRange = derivedFocusRange
        editor.view.dispatch(editor.view.state.tr)
      }
    }
  }, [focusModeEnabled, paragraphFocusMode, editor])

  // Register editor instance for keyboard shortcuts
  useEffect(() => {
    if (editor) setEditorInstance('main', editor)
    return () => setEditorInstance('main', null)
  }, [editor])

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  // Session stats timer
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
      if (currentContent.trim()) {
        await saveDraftVersion(currentChapterId, currentContent)
      }
      markSaved()
    } catch {
      setSaveStatus('unsaved')
    } finally {
      isSavingRef.current = false
    }
  }, [currentChapterId, currentContent, saveCurrentChapter, saveDraftVersion, setSaveStatus, markSaved])

  useEffect(() => {
    if (currentContent !== lastSavedContentRef.current) markUnsaved()
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(debouncedSave, 3000)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [currentContent, debouncedSave, markUnsaved])

  // Keyboard shortcut handling
  useEffect(() => {
    const handleKeyDown = (_e: KeyboardEvent) => {
      if (!editor) return
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editor])

  // Merge loading states from all stores for consumers
  const mergedLoading = {
    ai: aiLoading.ai,
    checkers: checkerLoading.checkers,
  }

  return {
    editor,
    editorContainerRef,
    chapterTitle,
    wordCount,
    currentContent,
    currentChapterId,
    writingStyle,
    humanAIRatio,
    loading: mergedLoading,
    saveStatus,
    lastSavedAt,
    focusModeEnabled,
    typewriterMode,
    paperEdgeDecoration,
    sessionDuration,
    sessionWPM,
    todayWordCount,
    targetWordCount,
    isTyping,
    isLoading,
    isEmpty,
  }
}
