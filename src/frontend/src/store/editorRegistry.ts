import { Editor } from '@tiptap/react'

// 全局编辑器实例注册表，支持多实例
const editorInstances = new Map<string, Editor>()

export function setEditorInstance(id: string, editor: Editor | null) {
  if (editor) {
    editorInstances.set(id, editor)
  } else {
    editorInstances.delete(id)
  }
}

// 向后兼容：不传参数返回 'main'
export function getEditorInstance(id: string = 'main'): Editor | null {
  return editorInstances.get(id) ?? null
}

export function getAllEditorInstances(): Map<string, Editor> {
  return new Map(editorInstances)
}

export function getActiveEditorInstance(): Editor | null {
  return editorInstances.get('main') ?? editorInstances.values().next().value ?? null
}
