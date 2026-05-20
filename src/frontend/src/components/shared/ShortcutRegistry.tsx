import { useAIStore } from '@/store'
import { getEditorInstance } from '@/store/editorRegistry'
import {
  AI_OPERATION_LABELS,
  type AIOperationType,
} from '@/constants/shortcuts'
import { showToast } from '@/components/ui/Toast'

/**
 * 执行AI操作并显示Toast通知
 */
export async function executeAIOperation(operation: AIOperationType, selectedText: string) {
  if (!selectedText.trim()) {
    showToast('请先选中要处理的文本', 'warning')
    return
  }

  const label = AI_OPERATION_LABELS[operation]
  showToast(`正在${label}...`, 'info')

  try {
    // 获取AI store中的操作方法
    const store = useAIStore.getState()
    let result: string

    switch (operation) {
      case 'optimize':
        result = await store.optimize(selectedText)
        break
      case 'expand':
        result = await store.expand(selectedText)
        break
      case 'condense':
        result = await store.condense(selectedText)
        break
      case 'rewrite':
        result = await store.rewrite(selectedText)
        break
      case 'continue':
        result = await store.continue(selectedText)
        break
      case 'polish':
        result = await store.polish(selectedText)
        break
      default:
        throw new Error(`未知AI操作: ${operation}`)
    }

    // 将结果插入编辑器（替换选中文本）
    const editor = getEditorInstance()
    if (editor && result) {
      editor
        .chain()
        .focus()
        .insertContentAt(editor.state.selection, result)
        .run()
    }

    showToast(`${label}完成`, 'success')
  } catch (error) {
    showToast(`${label}失败: ${(error as Error).message}`, 'error')
  }
}
