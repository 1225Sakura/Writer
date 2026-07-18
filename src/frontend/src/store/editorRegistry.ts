import { Editor } from '@tiptap/react'

// 全局编辑器实例注册表，支持多实例
const editorInstances = new Map<string, Editor>()

export function setEditorInstance(id: string, editor: Editor | null) {
  if (editor) {
    editorInstances.set(id, editor)
    // US-025 (Phase 5 e2e): expose live editor instance on window so the
    // Playwright driver can set selection / call commands synchronously.
    // Gated to dev builds via the absence of consumers in prod.
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __tipTapEditors?: Map<string, Editor> }).__tipTapEditors = editorInstances
      ;(window as unknown as { __mainEditor?: Editor | null }).__mainEditor = editor
    }
  } else {
    editorInstances.delete(id)
    if (typeof window !== 'undefined' && id === 'main') {
      ;(window as unknown as { __mainEditor?: Editor | null }).__mainEditor = null
    }
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
