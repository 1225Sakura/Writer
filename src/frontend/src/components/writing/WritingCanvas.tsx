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
      {/* 写作区域 - Linear paper/elevation model with translucent card */}
      <div className="flex-1 overflow-y-auto paper-texture-light">
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

      {/* 底部状态栏 - Linear深色风格 with elevation stepping */}
      <div className="h-9 flex items-center px-4 text-xs font-medium"
           style={{
             backgroundColor: 'var(--color-bg-surface)',
             borderTop: '1px solid var(--color-border-subtle)',
             color: 'var(--color-text-muted)',
             fontFamily: 'var(--font-sans)',
           }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{chapterTitle}</span>
        <span className="mx-2 opacity-30">|</span>
        <span>{wordCount} 字</span>
        <span className="mx-2 opacity-30">|</span>
        <span>本次写作: {sessionStats.charactersWritten} 字</span>
        <span className="mx-2 opacity-30">|</span>
        <span>人机比例: {humanAIRatio}%</span>
        <span className="mx-2 opacity-30">|</span>
        <span style={{ color: 'var(--color-character)' }}>文笔风格: {WRITING_STYLE_NAMES[writingStyle] || writingStyle}</span>
        {loading.ai && (
          <>
            <span className="mx-2 opacity-30">|</span>
            <span style={{ color: 'var(--accent-primary)' }}>AI处理中...</span>
          </>
        )}
      </div>
    </div>
  )
}
