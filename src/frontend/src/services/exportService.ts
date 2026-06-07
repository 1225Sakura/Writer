/**
 * Export/Import Service - Chat session data export and import
 *
 * Supports JSON (full session data) and Markdown (structured entity list).
 * Imports validate data format before restoring.
 */

import type { ChatMessageLocal, ExtractedEntityLocal } from '@/store/chatStore'

// ============================================
// Types
// ============================================

export interface ExportSessionData {
  version: string
  exportedAt: string
  sessionId: number
  messages: ChatMessageLocal[]
  entities: ExtractedEntityLocal[]
  metadata: {
    messageCount: number
    entityCount: number
    confirmedCount: number
  }
}

export interface ImportValidationResult {
  valid: boolean
  errors: string[]
  preview?: ExportSessionData
}

const CURRENT_VERSION = '1.0.0'

// ============================================
// JSON Export
// ============================================

/**
 * Export full session data as JSON string.
 */
export function exportToJSON(
  sessionId: number,
  messages: ChatMessageLocal[],
  entities: ExtractedEntityLocal[]
): string {
  const data: ExportSessionData = {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    sessionId,
    messages,
    entities,
    metadata: {
      messageCount: messages.length,
      entityCount: entities.length,
      confirmedCount: entities.filter((e) => e.confirmed).length,
    },
  }
  return JSON.stringify(data, null, 2)
}

/**
 * Trigger a browser download of JSON data.
 */
export function downloadJSON(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ============================================
// JSON Import
// ============================================

/**
 * Read and validate a JSON file for import.
 */
export function importFromJSON(file: File): Promise<ImportValidationResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const data = JSON.parse(text)
        const errors = validateImportData(data)
        if (errors.length > 0) {
          resolve({ valid: false, errors })
        } else {
          resolve({ valid: true, errors: [], preview: data as ExportSessionData })
        }
      } catch {
        resolve({ valid: false, errors: ['文件格式无效，无法解析 JSON'] })
      }
    }
    reader.onerror = () => {
      resolve({ valid: false, errors: ['读取文件失败'] })
    }
    reader.readAsText(file)
  })
}

function validateImportData(data: unknown): string[] {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    errors.push('数据格式错误：不是有效的对象')
    return errors
  }

  const obj = data as Record<string, unknown>

  if (!obj.version || typeof obj.version !== 'string') {
    errors.push('缺少版本号字段 (version)')
  }

  if (!Array.isArray(obj.messages)) {
    errors.push('缺少消息数组 (messages)')
  } else {
    const msgs = obj.messages as unknown[]
    for (let i = 0; i < Math.min(msgs.length, 3); i++) {
      const msg = msgs[i] as Record<string, unknown>
      if (!msg.id || !msg.role || !msg.content) {
        errors.push(`消息 #${i} 缺少必要字段 (id/role/content)`)
      }
    }
  }

  if (!Array.isArray(obj.entities)) {
    errors.push('缺少实体数组 (entities)')
  } else {
    const ents = obj.entities as unknown[]
    for (let i = 0; i < Math.min(ents.length, 3); i++) {
      const ent = ents[i] as Record<string, unknown>
      if (!ent.id || !ent.type || !ent.name) {
        errors.push(`实体 #${i} 缺少必要字段 (id/type/name)`)
      }
    }
  }

  return errors
}

// ============================================
// Markdown Export
// ============================================

const categoryLabels: Record<string, string> = {
  world: '世界观',
  character: '角色',
  item: '物品',
  location: '地点',
  faction: '势力',
  rule: '规则',
  ifline: 'IF线',
}

/**
 * Export entities and messages as structured Markdown.
 */
export function exportToMarkdown(
  entities: ExtractedEntityLocal[],
  messages: ChatMessageLocal[]
): string {
  const lines: string[] = []

  lines.push('# 会话导出')
  lines.push('')
  lines.push(`> 导出时间: ${new Date().toLocaleString('zh-CN')}`)
  lines.push(`> 消息数量: ${messages.length}`)
  lines.push(`> 实体数量: ${entities.length}`)
  lines.push('')

  // Entities grouped by type
  lines.push('## 实体列表')
  lines.push('')

  const grouped = new Map<string, ExtractedEntityLocal[]>()
  for (const entity of entities) {
    const list = grouped.get(entity.type) ?? []
    list.push(entity)
    grouped.set(entity.type, list)
  }

  for (const [type, groupEntities] of grouped) {
    const label = categoryLabels[type] ?? type
    lines.push(`### ${label} (${groupEntities.length})`)
    lines.push('')
    for (const entity of groupEntities) {
      const status = entity.confirmed ? '✅ 已确认' : '⏳ 待确认'
      lines.push(`- **${entity.name}** — ${status}`)
      if (entity.description) {
        lines.push(`  ${entity.description}`)
      }
    }
    lines.push('')
  }

  // Messages
  lines.push('## 对话记录')
  lines.push('')
  for (const msg of messages) {
    const role = msg.role === 'user' ? '👤 用户' : '🤖 AI'
    const time = new Date(msg.createdAt).toLocaleString('zh-CN')
    lines.push(`### ${role} (${time})`)
    lines.push('')
    lines.push(msg.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Trigger a browser download of Markdown data.
 */
export function downloadMarkdown(md: string, filename: string): void {
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
