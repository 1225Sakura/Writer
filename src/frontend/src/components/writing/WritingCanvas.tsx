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
          'writing-area prose prose-lg max-w-none focus:outline-none min-h-full px-8 py-6',
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
    <div className="h-full flex flex-col bg-[#faf6e8] dark:bg-[#1a1a2e]">
      {/* 章节标题 */}
      <div className="px-8 pt-8 pb-2">
        <h1
          className="font-['Inter'] text-2xl font-medium tracking-tight text-[#2d2d2d] dark:text-[#f5f0e6]"
          style={{ lineHeight: 1.75 }}
        >
          {chapterTitle}
        </h1>
      </div>

      {/* 写作区域 */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent
          editor={editor}
          className="min-h-full"
        />
      </div>

      {/* 底部状态栏 */}
      <div className="h-8 border-t border-[rgba(255,255,255,0.08)] bg-[#0f1011] flex items-center px-4 text-xs text-[#d0d6e0] font-['Inter']">
        <span className="font-medium">{chapterTitle}</span>
        <span className="mx-2 opacity-40">|</span>
        <span>{wordCount} 字</span>
        <span className="mx-2 opacity-40">|</span>
        <span>人机比例: {humanAIRatio}%</span>
        <span className="mx-2 opacity-40">|</span>
        <span className="text-[#e8b87d]">文笔风格: {WRITING_STYLE_NAMES[writingStyle] || writingStyle}</span>
      </div>
    </div>
  )
}
