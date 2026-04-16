import { Editor } from '@tiptap/react'

// 全局编辑器实例注册表，供快捷键使用
let editorInstance: Editor | null = null

export function setEditorInstance(editor: Editor | null) {
  editorInstance = editor
}

export function getEditorInstance(): Editor | null {
  return editorInstance
}
