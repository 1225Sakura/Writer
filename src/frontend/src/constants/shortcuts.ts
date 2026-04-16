/**
 * 快捷键常量定义
 */

// 快捷键组合
export const KEYBOARD_SHORTCUTS = {
  // Ctrl+\
  TOGGLE_AI_DRAWER: { ctrlKey: true, key: '\\' },
  // Ctrl+/
  TOGGLE_COLLABORATION: { ctrlKey: true, key: '/' },
  // Ctrl+S
  SAVE: { ctrlKey: true, key: 's' },
  // F11
  FULLSCREEN: { key: 'F11' },
  // Ctrl+Shift+O
  AI_OPTIMIZE: { ctrlKey: true, shiftKey: true, key: 'O' },
  // Ctrl+Shift+E
  AI_EXPAND: { ctrlKey: true, shiftKey: true, key: 'E' },
  // Ctrl+Shift+S
  AI_SHRINK: { ctrlKey: true, shiftKey: true, key: 'S' },
  // Ctrl+Shift+R
  AI_REWRITE: { ctrlKey: true, shiftKey: true, key: 'R' },
  // Ctrl+Shift+W
  AI_CONTINUE: { ctrlKey: true, shiftKey: true, key: 'W' },
  // Ctrl+Shift+P
  AI_POLISH: { ctrlKey: true, shiftKey: true, key: 'P' },
} as const

// AI 操作类型
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

// Ctrl+Shift+按键对应的AI操作
export const AI_SHORTCUT_OPERATIONS: Record<string, AIOperationType> = {
  O: 'optimize',
  E: 'expand',
  S: 'shrink',
  R: 'rewrite',
  W: 'continue',
  P: 'polish',
} as const
