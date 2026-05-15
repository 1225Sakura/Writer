import type { InterfaceType } from '@/store/uiStore'
import { useGlobalShortcuts } from './ShortcutListener'

/**
 * 快捷键管理器组件
 * 在 App 层级挂载，管理所有全局快捷键
 */
export function ShortcutManager() {
  useGlobalShortcuts()
  return null
}

/**
 * 获取当前界面可用的快捷键提示文本
 */
export function getShortcutsHelpText(interfaceType: InterfaceType): string {
  const shortcuts: Record<string, string[]> = {
    global: [
      'Ctrl+K: 命令面板',
      'Ctrl+Shift+T: 切换主题',
      'Ctrl+Shift+?: 快捷键帮助',
    ],
    navigation: [
      'Ctrl+Alt+1: 聊天初始化',
      'Ctrl+Alt+2: 设定编辑',
      'Ctrl+Alt+3: 正文写作',
    ],
    writing: [
      'Ctrl+S: 保存',
      'Ctrl+N: 新建章节',
      'Ctrl+\\: 切换AI面板',
      'Ctrl+/: 切换协作面板',
      'Ctrl+Shift+O: 切换大纲面板',
      'F11: 全屏写作',
      'Ctrl+Shift+I: 沉浸模式',
      'Ctrl+Shift+F: 专注模式',
      'Ctrl+Shift+O: AI优化',
      'Ctrl+Shift+E: AI扩写',
      'Ctrl+Shift+S: AI缩写',
      'Ctrl+Shift+R: AI改写',
      'Ctrl+Shift+W: AI续写',
      'Ctrl+Shift+P: AI润色',
    ],
  }

  const lines: string[] = []
  lines.push(...shortcuts.global)
  lines.push(...shortcuts.navigation)
  if (interfaceType === 'writing') {
    lines.push(...shortcuts.writing)
  }
  return lines.join('\n')
}
