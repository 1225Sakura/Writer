/**
 * EntityChatPanel — Conversational AI editing panel for entities.
 * Slides in from the right when a user clicks an entity to chat-edit it.
 *
 * US-014: Entity-level AI dialogue
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Sparkles, Check, RotateCcw } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { api } from '@/api/request'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldChange {
  field: string
  oldValue: unknown
  newValue: unknown
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  fieldChanges?: FieldChange[]
}

export interface EntityChatPanelProps {
  entity: Record<string, unknown> | null
  entityType: string
  onClose: () => void
  onApplyChanges: (entityId: number, changes: Record<string, unknown>) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0
const nextId = () => `msg-${Date.now()}-${++counter}`
const fmtTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const trunc = (v: unknown, max = 60) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > max ? s.slice(0, max) + '...' : s
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DiffPreview({ changes }: { changes: FieldChange[] }) {
  return (
    <motion.div className="mt-2 space-y-1.5" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: DURATION.NORMAL }}>
      {changes.map((c) => (
        <div key={c.field} className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--color-surface-overlay)', border: `1px solid var(--border-subtle)` }}>
          <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>{c.field}</span>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="line-through rounded px-1.5 py-0.5" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>
              {trunc(c.oldValue)}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>&rarr;</span>
            <span className="rounded px-1.5 py-0.5" style={{ background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: 'var(--color-success)' }}>
              {trunc(c.newValue)}
            </span>
          </div>
        </div>
      ))}
    </motion.div>
  )
}

function Bubble({ msg, onApply, onDiscard }: { msg: ChatMessage; onApply?: () => void; onDiscard?: () => void }) {
  const isUser = msg.role === 'user'
  const hasDiff = (msg.fieldChanges?.length ?? 0) > 0
  const bubbleBg = isUser ? 'color-mix(in srgb, var(--accent-primary) 20%, transparent)' : 'var(--color-surface-raised)'
  const bubbleBorder = isUser ? 'color-mix(in srgb, var(--accent-primary) 25%, transparent)' : 'var(--border-subtle)'

  return (
    <motion.div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`} initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`} style={{ background: bubbleBg, color: 'var(--text-primary)', border: `1px solid ${bubbleBorder}` }}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {hasDiff && (
          <>
            <DiffPreview changes={msg.fieldChanges!} />
            <div className="mt-2 flex gap-2">
              <motion.button onClick={onApply} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 15%, transparent), color-mix(in srgb, var(--color-success) 8%, transparent))', color: 'var(--color-success)', border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Icon icon={Check} size="xs" color="success" />应用修改
              </motion.button>
              <motion.button onClick={onDiscard} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: 'var(--text-tertiary)', border: `1px solid var(--border-default)` }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Icon icon={RotateCcw} size="xs" color="muted" />忽略
              </motion.button>
            </div>
          </>
        )}
        <span className="block text-[10px] mt-1.5 select-none" style={{ color: 'var(--text-disabled)' }}>{msg.timestamp}</span>
      </div>
    </motion.div>
  )
}

function TypingDots() {
  return (
    <motion.div className="flex justify-start mb-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: DURATION.FAST }}>
      <div className="rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1" style={{ background: 'var(--color-surface-raised)', border: `1px solid var(--border-subtle)` }}>
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-tertiary)' }} animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }} />
        ))}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Entity Chat API call
// ---------------------------------------------------------------------------

interface EntityChatResponse {
  reply?: string
  field_changes?: Array<{ field: string; old_value: unknown; new_value: unknown }>
}

async function sendEntityChat(
  entity: Record<string, unknown>,
  entityType: string,
  entityId: number | undefined,
  userText: string,
  history: ChatMessage[],
  signal: AbortSignal,
): Promise<ChatMessage> {
  const ctx = Object.entries(entity)
    .filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k))
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')

  const prompt = [
    `你是一个小说设定助手。用户正在编辑一个「${entityType}」类型的实体。`,
    `当前实体数据：`, ctx, '',
    `用户请求：${userText}`, '',
    '请根据用户请求回复。如果需要修改字段，请在回复的JSON中包含 field_changes 数组。',
    '{"reply": "你的回复", "field_changes": [{"field": "字段名", "old_value": "旧值", "new_value": "新值"}]}',
    '如果没有字段修改，只返回纯文本回复即可。',
  ].join('\n')

  const resp = await api.post<EntityChatResponse | string>('/ai/entity-chat', {
    entity_type: entityType, entity_id: entityId, entity_data: entity,
    message: prompt,
    history: history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
  }, { signal })

  const reply = typeof resp === 'string' ? resp : resp?.reply || '收到，但未能生成回复。'
  const raw = typeof resp === 'object' && resp !== null ? resp.field_changes : undefined

  return {
    id: nextId(), role: 'assistant', content: reply, timestamp: fmtTime(),
    fieldChanges: raw?.map((c) => ({ field: c.field, oldValue: c.old_value, newValue: c.new_value })),
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function EntityChatPanel({ entity, entityType, onClose, onApplyChanges }: EntityChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const name = (entity?.name as string) || (entity?.title as string) || '未命名实体'
  const eid = entity?.id as number | undefined

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => () => { abortRef.current?.abort() }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || !entity) return
    setMessages((p) => [...p, { id: nextId(), role: 'user', content: text, timestamp: fmtTime() }])
    setInput('')
    setLoading(true)
    try {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const reply = await sendEntityChat(entity, entityType, eid, text, messages, abortRef.current.signal)
      setMessages((p) => [...p, reply])
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'CANCELLED_ERROR') return
      setMessages((p) => [...p, { id: nextId(), role: 'assistant', content: '抱歉，请求失败了。请检查网络连接后重试。', timestamp: fmtTime() }])
    } finally { setLoading(false) }
  }, [input, loading, entity, entityType, eid, messages])

  const onKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }, [send])

  const apply = useCallback((mid: string) => {
    const msg = messages.find((m) => m.id === mid)
    if (!msg?.fieldChanges || eid === undefined) return
    const ch: Record<string, unknown> = {}
    for (const c of msg.fieldChanges) ch[c.field] = c.newValue
    onApplyChanges(eid, ch)
    setMessages((p) => p.map((m) => m.id === mid ? { ...m, fieldChanges: undefined } : m))
  }, [messages, eid, onApplyChanges])

  const discard = useCallback((mid: string) => {
    setMessages((p) => p.map((m) => m.id === mid ? { ...m, fieldChanges: undefined } : m))
  }, [])

  if (!entity) return null

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-40" style={{ background: 'var(--color-overlay-light)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DURATION.FAST }} onClick={onClose} />
      <motion.div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{ width: 380, maxWidth: '90vw', background: 'var(--color-surface-base)', borderLeft: `1px solid var(--border-default)`, boxShadow: 'var(--shadow-drawer)' }}
        initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
        transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid var(--border-subtle)` }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' }}>
              <Icon icon={Sparkles} size="sm" color="accent" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{name}</div>
              <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>AI 对话编辑</div>
            </div>
          </div>
          <motion.button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-tertiary)' }} whileHover={{ background: 'var(--color-surface-hover)', scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Icon icon={X} size="sm" color="muted" />
          </motion.button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarGutter: 'stable' }}>
          {messages.length === 0 && !loading && (
            <motion.div className="flex flex-col items-center justify-center h-full text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}>
              <div className="p-3 rounded-2xl mb-4" style={{ background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' }}>
                <Icon icon={Sparkles} size="lg" color="accent" />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>和 AI 对话编辑「{name}」</p>
              <p className="text-xs max-w-[240px]" style={{ color: 'var(--text-tertiary)' }}>描述你想要的修改，AI 会帮你更新设定字段。例如：「给这个角色添加一个弱点」</p>
            </motion.div>
          )}
          {messages.map((m) => <Bubble key={m.id} msg={m} onApply={() => apply(m.id)} onDiscard={() => discard(m.id)} />)}
          <AnimatePresence>{loading && <TypingDots />}</AnimatePresence>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: `1px solid var(--border-subtle)` }}>
          <div className="flex items-end gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--color-surface-raised)', border: `1px solid var(--border-default)` }}>
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} placeholder="描述你想要的修改..." rows={1} disabled={loading} className="flex-1 bg-transparent resize-none text-sm outline-none leading-relaxed" style={{ color: 'var(--text-primary)', maxHeight: 120, caretColor: 'var(--accent-primary)' }} />
            <motion.button onClick={send} disabled={!input.trim() || loading} className="p-2 rounded-lg flex-shrink-0" style={{ background: input.trim() ? 'color-mix(in srgb, var(--accent-primary) 18%, transparent)' : 'transparent', color: input.trim() ? 'var(--accent-primary)' : 'var(--text-disabled)', cursor: input.trim() ? 'pointer' : 'default' }} whileHover={input.trim() ? { scale: 1.08, boxShadow: 'var(--shadow-glow-sm)' } : {}} whileTap={input.trim() ? { scale: 0.92 } : {}}>
              <Icon icon={Send} size="sm" color={input.trim() ? 'accent' : 'muted'} />
            </motion.button>
          </div>
          <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--text-disabled)' }}>Enter 发送 &middot; Shift+Enter 换行</p>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
