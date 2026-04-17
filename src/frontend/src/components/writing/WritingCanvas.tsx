import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { useWritingStore } from '@/store'
import { setEditorInstance } from '@/store/editorRegistry'
import { useEffect, useRef, useCallback, useState } from 'react'

const WRITING_STYLE_NAMES: Record<string, string> = {
  default: '默认',
  jiangnan: '江南',
  kafka: '卡夫卡',
  camus: '加缪',
  custom: '自定义',
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
  } = useWritingStore()

  const [sessionStats, setSessionStats] = useState({ startTime: Date.now(), charactersWritten: 0 })
  const currentChapter = chapters.find((c) => c.id === currentChapterId)
  const chapterTitle = currentChapter?.title || '未选择章节'
  const isSavingRef = useRef(false)
  const lastSavedContentRef = useRef('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastWordCountRef = useRef(wordCount)

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
    ],
    content: currentContent,
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      updateContent(text)
      // Track characters written in session
      if (wordCount > lastWordCountRef.current) {
        setSessionStats(prev => ({
          ...prev,
          charactersWritten: prev.charactersWritten + (wordCount - lastWordCountRef.current)
        }))
      }
      lastWordCountRef.current = wordCount
    },
    editorProps: {
      attributes: {
        class: 'writing-area max-w-none focus:outline-none min-h-full px-8 py-6',
      },
    },
  })

  // 同步外部内容变化
  useEffect(() => {
    if (editor && currentContent !== editor.getText()) {
      editor.commands.setContent(currentContent)
    }
  }, [currentContent, editor])

  // 注册编辑器实例供快捷键使用
  useEffect(() => {
    if (editor) {
      setEditorInstance(editor)
    }
    return () => {
      setEditorInstance(null)
    }
  }, [editor])

  // 自动保存 - debounce 3秒
  const debouncedSave = useCallback(async () => {
    if (!currentChapterId || isSavingRef.current) return
    if (currentContent === lastSavedContentRef.current) return

    isSavingRef.current = true
    try {
      await saveCurrentChapter()
      lastSavedContentRef.current = currentContent
      // 保存草稿版本
      if (currentContent.trim()) {
        await saveDraftVersion(currentChapterId, currentContent)
      }
    } catch (error) {
      console.error('自动保存失败:', error)
    } finally {
      isSavingRef.current = false
    }
  }, [currentChapterId, currentContent, saveCurrentChapter, saveDraftVersion])

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(debouncedSave, 3000)
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [currentContent, debouncedSave])

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
      {/* 写作区域 - 温暖宣纸背景 */}
      <div className="flex-1 overflow-y-auto bg-[var(--color-writing-light)] paper-texture-light">
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
          {/* 柔和分隔线 - 温暖的淡金色 */}
          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-[var(--color-divider)] to-transparent opacity-60" />
        </div>

        {/* 正文编辑器 */}
        <EditorContent
          editor={editor}
          className="min-h-full px-12 pb-12"
        />
      </div>

      {/* 底部状态栏 - Linear深色风格 */}
      <div className="h-8 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-subtle)] flex items-center px-4 text-xs text-[var(--color-text-muted)] font-['Inter']">
        <span className="text-[var(--color-text-secondary)] font-medium">{chapterTitle}</span>
        <span className="mx-2 opacity-30">|</span>
        <span>{wordCount} 字</span>
        <span className="mx-2 opacity-30">|</span>
        <span>本次写作: {sessionStats.charactersWritten} 字</span>
        <span className="mx-2 opacity-30">|</span>
        <span>人机比例: {humanAIRatio}%</span>
        <span className="mx-2 opacity-30">|</span>
        <span className="text-[#e8b87d]">文笔风格: {WRITING_STYLE_NAMES[writingStyle] || writingStyle}</span>
        {loading.ai && (
          <>
            <span className="mx-2 opacity-30">|</span>
            <span className="text-[var(--color-accent)]">AI处理中...</span>
          </>
        )}
      </div>
    </div>
  )
}
