import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useWritingStore } from '@/store'
import { setEditorInstance } from '@/store/editorRegistry'
import { useEffect } from 'react'

const WRITING_STYLE_NAMES: Record<string, string> = {
  default: '默认',
  jiangnan: '江南',
  kafka: '卡夫卡',
  camus: '加缪',
  custom: '自定义',
}

export function WritingCanvas() {
  const { currentContent, updateContent, wordCount, currentChapterId, chapters, writingStyle, humanAIRatio } = useWritingStore()

  const currentChapter = chapters.find((c) => c.id === currentChapterId)
  const chapterTitle = currentChapter?.title || '未选择章节'

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '开始你的创作...',
      }),
    ],
    content: currentContent,
    onUpdate: ({ editor }) => {
      updateContent(editor.getText())
    },
    editorProps: {
      attributes: {
        class:
          'writing-area max-w-none focus:outline-none min-h-full px-8 py-6',
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
    <div className="h-full flex flex-col bg-[#1a1a2e]">
      {/* 写作区域 - 温暖宣纸背景 */}
      <div className="flex-1 overflow-y-auto bg-[#faf6e8]">
        {/* 章节标题 - 与正文融合过渡 */}
        <div className="px-12 pt-10 pb-4">
          <h1
            className="font-['Source_Serif_4','Noto_Serif_SC',Georgia,serif] text-2xl font-medium tracking-tight text-[#3d3d3d]"
            style={{
              lineHeight: 1.75,
              letterSpacing: '-0.02em',
            }}
          >
            {chapterTitle}
          </h1>
          {/* 柔和分隔线 */}
          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-[#d4c8a8] to-transparent opacity-60" />
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
        <span>人机比例: {humanAIRatio}%</span>
        <span className="mx-2 opacity-30">|</span>
        <span className="text-[#e8b87d]">文笔风格: {WRITING_STYLE_NAMES[writingStyle] || writingStyle}</span>
      </div>
    </div>
  )
}
