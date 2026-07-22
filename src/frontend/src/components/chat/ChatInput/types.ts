/**
 * ChatInput shared types and slash command catalog.
 *
 * Phase 0b.2 split: InputField.tsx (826 lines) -> 5 sub-components under
 * src/components/chat/ChatInput/. This file holds cross-component contracts.
 */
import type { ElementType } from 'react'
import { BookOpen, Users, ScrollText, FileText, Trash2, HelpCircle } from 'lucide-react'

export const MAX_INPUT_LENGTH = 500

export interface SlashCommand {
  name: string
  label: string
  description: string
  icon: ElementType
  /** Preset text to fill into the input when selected */
  preset?: string
  /** Action to execute when selected (instead of filling text) */
  action?: 'export' | 'clear' | 'help'
}

export const slashCommands: SlashCommand[] = [
  { name: '/世界观', label: '世界观', description: '生成世界观设定', icon: BookOpen, preset: '请帮我构建完整的世界观设定，包括地理、历史、文明和世界规则。' },
  { name: '/角色', label: '角色', description: '创建角色设定', icon: Users, preset: '请帮我创建角色设定，包括姓名、性格、背景故事和能力。' },
  { name: '/物品', label: '物品', description: '设计重要物品', icon: ScrollText, preset: '请帮我设计故事中的重要物品，包括名称、来历、特殊属性和在剧情中的作用。' },
  { name: '/导出', label: '导出', description: '导出设定到大纲', icon: FileText, action: 'export' },
  { name: '/清空', label: '清空', description: '清空当前对话', icon: Trash2, action: 'clear' },
  { name: '/帮助', label: '帮助', description: '查看可用命令', icon: HelpCircle, action: 'help' },
]

export interface InputFieldProps {
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onNewChat: () => void
  onAttachClick?: () => void
  onExportOutline?: () => void
  onClearChat?: () => void
  isLoading: boolean
  isStreaming: boolean
  canSend: boolean
}