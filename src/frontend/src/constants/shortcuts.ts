/**
 * 快捷键常量定义
 * 包含所有界面的快捷键配置、AI操作映射、以及命令面板使用的命令定义
 */

import type { AIOperationType } from './shortcuts'

// ============ 界面类型 ============
export type InterfaceType = 'chat' | 'settings' | 'writing' | 'global'

// ============ 快捷键定义 ============
export interface ShortcutDef {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  label: string
  description: string
  interfaces: InterfaceType[]
  category: 'navigation' | 'file' | 'view' | 'ai' | 'editor' | 'system'
}

// 全局快捷键（在所有界面生效）
export const GLOBAL_SHORTCUTS = {
  // 打开命令面板
  COMMAND_PALETTE: {
    ctrlKey: true,
    key: 'k',
    label: '命令面板',
    description: '打开命令面板，快速执行操作',
    interfaces: ['chat', 'settings', 'writing', 'global'] as InterfaceType[],
    category: 'navigation' as const,
  },
  // 切换主题
  TOGGLE_THEME: {
    ctrlKey: true,
    shiftKey: true,
    key: 'T',
    label: '切换主题',
    description: '切换深色/浅色模式',
    interfaces: ['chat', 'settings', 'writing', 'global'] as InterfaceType[],
    category: 'system' as const,
  },
  // 显示快捷键帮助
  SHOW_SHORTCUTS_HELP: {
    ctrlKey: true,
    shiftKey: true,
    key: '?',
    label: '快捷键帮助',
    description: '显示所有可用快捷键',
    interfaces: ['chat', 'settings', 'writing', 'global'] as InterfaceType[],
    category: 'system' as const,
  },
} as const

// 界面导航快捷键
export const NAVIGATION_SHORTCUTS = {
  // 跳转到聊天界面
  GOTO_CHAT: {
    ctrlKey: true,
    altKey: true,
    key: '1',
    label: '聊天初始化',
    description: '跳转到聊天初始化界面',
    interfaces: ['settings', 'writing', 'global'] as InterfaceType[],
    category: 'navigation' as const,
  },
  // 跳转到设定界面
  GOTO_SETTINGS: {
    ctrlKey: true,
    altKey: true,
    key: '2',
    label: '设定编辑',
    description: '跳转到设定编辑界面',
    interfaces: ['chat', 'writing', 'global'] as InterfaceType[],
    category: 'navigation' as const,
  },
  // 跳转到写作界面
  GOTO_WRITING: {
    ctrlKey: true,
    altKey: true,
    key: '3',
    label: '正文写作',
    description: '跳转到正文写作界面',
    interfaces: ['chat', 'settings', 'global'] as InterfaceType[],
    category: 'navigation' as const,
  },
} as const

// 文件操作快捷键
export const FILE_SHORTCUTS = {
  // 保存
  SAVE: {
    ctrlKey: true,
    key: 's',
    label: '保存',
    description: '保存当前内容',
    interfaces: ['writing', 'settings'] as InterfaceType[],
    category: 'file' as const,
  },
  // 新建章节
  NEW_CHAPTER: {
    ctrlKey: true,
    key: 'n',
    label: '新建章节',
    description: '创建新章节',
    interfaces: ['writing'] as InterfaceType[],
    category: 'file' as const,
  },
} as const

// 视图操作快捷键
export const VIEW_SHORTCUTS = {
  // 切换 AI 抽屉
  TOGGLE_AI_DRAWER: {
    ctrlKey: true,
    key: '\\',
    label: '切换AI面板',
    description: '切换AI操作抽屉',
    interfaces: ['writing'] as InterfaceType[],
    category: 'view' as const,
  },
  // 切换协作面板
  TOGGLE_COLLABORATION: {
    ctrlKey: true,
    key: '/',
    label: '切换协作面板',
    description: '切换协作面板抽屉',
    interfaces: ['writing'] as InterfaceType[],
    category: 'view' as const,
  },
  // 切换大纲面板
  TOGGLE_OUTLINE: {
    ctrlKey: true,
    shiftKey: true,
    key: 'O',
    label: '切换大纲面板',
    description: '切换大纲面板',
    interfaces: ['writing'] as InterfaceType[],
    category: 'view' as const,
  },
  // 全屏写作
  FULLSCREEN: {
    key: 'F11',
    label: '全屏写作',
    description: '切换全屏写作模式',
    interfaces: ['writing'] as InterfaceType[],
    category: 'view' as const,
  },
  // 沉浸模式
  IMMERSIVE_MODE: {
    ctrlKey: true,
    shiftKey: true,
    key: 'I',
    label: '沉浸模式',
    description: '切换沉浸写作模式',
    interfaces: ['writing'] as InterfaceType[],
    category: 'view' as const,
  },
  // 专注模式
  FOCUS_MODE: {
    ctrlKey: true,
    shiftKey: true,
    key: 'F',
    label: '专注模式',
    description: '切换专注模式',
    interfaces: ['writing'] as InterfaceType[],
    category: 'view' as const,
  },
} as const

// AI 操作快捷键（Ctrl+Shift+字母）
export const AI_SHORTCUTS = {
  // Ctrl+Shift+O 优化
  AI_OPTIMIZE: {
    ctrlKey: true,
    shiftKey: true,
    key: 'O',
    label: 'AI优化',
    description: '优化选中文本',
    interfaces: ['writing'] as InterfaceType[],
    category: 'ai' as const,
  },
  // Ctrl+Shift+E 扩写
  AI_EXPAND: {
    ctrlKey: true,
    shiftKey: true,
    key: 'E',
    label: 'AI扩写',
    description: '扩写选中文本',
    interfaces: ['writing'] as InterfaceType[],
    category: 'ai' as const,
  },
  // Ctrl+Shift+S 缩写
  AI_SHRINK: {
    ctrlKey: true,
    shiftKey: true,
    key: 'S',
    label: 'AI缩写',
    description: '缩写选中文本',
    interfaces: ['writing'] as InterfaceType[],
    category: 'ai' as const,
  },
  // Ctrl+Shift+R 改写
  AI_REWRITE: {
    ctrlKey: true,
    shiftKey: true,
    key: 'R',
    label: 'AI改写',
    description: '改写选中文本',
    interfaces: ['writing'] as InterfaceType[],
    category: 'ai' as const,
  },
  // Ctrl+Shift+W 续写
  AI_CONTINUE: {
    ctrlKey: true,
    shiftKey: true,
    key: 'W',
    label: 'AI续写',
    description: '续写当前内容',
    interfaces: ['writing'] as InterfaceType[],
    category: 'ai' as const,
  },
  // Ctrl+Shift+P 润色
  AI_POLISH: {
    ctrlKey: true,
    shiftKey: true,
    key: 'P',
    label: 'AI润色',
    description: '润色选中文本',
    interfaces: ['writing'] as InterfaceType[],
    category: 'ai' as const,
  },
} as const

// 编辑器快捷键
export const EDITOR_SHORTCUTS = {
  // 撤销
  UNDO: {
    ctrlKey: true,
    key: 'z',
    label: '撤销',
    description: '撤销上一步操作',
    interfaces: ['writing', 'settings'] as InterfaceType[],
    category: 'editor' as const,
  },
  // 重做
  REDO: {
    ctrlKey: true,
    shiftKey: true,
    key: 'Z',
    label: '重做',
    description: '重做上一步操作',
    interfaces: ['writing', 'settings'] as InterfaceType[],
    category: 'editor' as const,
  },
  // 查找
  FIND: {
    ctrlKey: true,
    key: 'f',
    label: '查找',
    description: '查找文本',
    interfaces: ['writing', 'settings'] as InterfaceType[],
    category: 'editor' as const,
  },
  // 全选
  SELECT_ALL: {
    ctrlKey: true,
    key: 'a',
    label: '全选',
    description: '全选文本',
    interfaces: ['writing', 'settings', 'chat'] as InterfaceType[],
    category: 'editor' as const,
  },
} as const

// 合并所有快捷键
export const ALL_SHORTCUTS = {
  ...GLOBAL_SHORTCUTS,
  ...NAVIGATION_SHORTCUTS,
  ...FILE_SHORTCUTS,
  ...VIEW_SHORTCUTS,
  ...AI_SHORTCUTS,
  ...EDITOR_SHORTCUTS,
} as const

export type ShortcutKey = keyof typeof ALL_SHORTCUTS

// ============ AI 操作类型 ============
export type AIOperationType = 'optimize' | 'expand' | 'shrink' | 'rewrite' | 'continue' | 'polish'

// AI 操作标签
export const AI_OPERATION_LABELS: Record<AIOperationType, string> = {
  optimize: '优化',
  expand: '扩写',
  shrink: '缩写',
  rewrite: '改写',
  continue: '续写',
  polish: '润色',
} as const

// AI 操作描述
export const AI_OPERATION_DESCRIPTIONS: Record<AIOperationType, string> = {
  optimize: '优化文本表达，提升文采',
  expand: '扩展文本内容，增加细节描写',
  shrink: '精简文本，去除冗余',
  rewrite: '以不同风格重新表达',
  continue: '基于上下文续写内容',
  polish: '润色文本，改善流畅度',
} as const

// Ctrl+Shift+按键对应的AI操作
export const AI_SHORTCUT_OPERATIONS: Record<string, AIOperationType> = {
  O: 'optimize',
  E: 'expand',
  S: 'shrink',
  R: 'rewrite',
  W: 'continue',
  P: 'polish',
} as const

// ============ 快捷键格式化 ============
/**
 * 将快捷键定义格式化为显示字符串
 * 例如: { ctrlKey: true, key: 's' } => "Ctrl+S"
 */
export function formatShortcut(shortcut: {
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  key: string
}): string {
  const parts: string[] = []
  if (shortcut.ctrlKey) parts.push('Ctrl')
  if (shortcut.altKey) parts.push('Alt')
  if (shortcut.shiftKey) parts.push('Shift')
  if (shortcut.metaKey) parts.push('Cmd')
  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key)
  return parts.join('+')
}

/**
 * 获取所有快捷键的格式化列表
 */
export function getAllShortcutsList(): Array<{
  id: string
  label: string
  description: string
  shortcut: string
  interfaces: InterfaceType[]
  category: string
}> {
  return Object.entries(ALL_SHORTCUTS).map(([id, def]) => ({
    id,
    label: def.label,
    description: def.description,
    shortcut: formatShortcut(def),
    interfaces: def.interfaces,
    category: def.category,
  }))
}

/**
 * 获取指定界面可用的快捷键
 */
export function getShortcutsForInterface(
  interfaceType: InterfaceType
): Array<{
  id: string
  label: string
  description: string
  shortcut: string
  category: string
}> {
  return getAllShortcutsList().filter(
    (s) => s.interfaces.includes(interfaceType) || s.interfaces.includes('global')
  )
}

/**
 * 按分类获取快捷键
 */
export function getShortcutsByCategory(
  interfaceType: InterfaceType
): Record<string, Array<{ id: string; label: string; description: string; shortcut: string }>> {
  const shortcuts = getShortcutsForInterface(interfaceType)
  const grouped: Record<string, Array<{ id: string; label: string; description: string; shortcut: string }>> = {}

  for (const s of shortcuts) {
    if (!grouped[s.category]) {
      grouped[s.category] = []
    }
    grouped[s.category].push({
      id: s.id,
      label: s.label,
      description: s.description,
      shortcut: s.shortcut,
    })
  }

  return grouped
}

// 分类显示名称
export const CATEGORY_LABELS: Record<string, string> = {
  navigation: '导航',
  file: '文件',
  view: '视图',
  ai: 'AI操作',
  editor: '编辑',
  system: '系统',
} as const

// 界面显示名称
export const INTERFACE_LABELS: Record<InterfaceType, string> = {
  chat: '聊天初始化',
  settings: '设定编辑',
  writing: '正文写作',
  global: '全局',
} as const
