/**
 * Settings AI Button Group (US-019 polish).
 *
 * Four buttons that drive the per-entity AI endpoints exposed by the
 * backend in US-008..US-011:
 *   - "生成实体"   → POST /api/v1/ai/generate-entity
 *   - "审查一致性" → POST /api/v1/ai/review-consistency
 *   - "填充字段"   → POST /api/v1/ai/fill-fields
 *   - "改写描述"   → POST /api/v1/ai/rewrite-description
 *
 * Every successful invocation emits an `ai-log:append` IPC payload so the
 * canonical `userData/ai-log.jsonl` captures which entity-level AI call
 * fired (see US-018).
 *
 * Buttons operate on the currently-selected entity (or, for "生成实体",
 * the active entity category when no entity is selected). The parent
 * passes `projectId` (always required) and the optional `entityType` /
 * `entityId` pair.
 */
import { useCallback, useState } from 'react'
import { Sparkles, ShieldCheck, Wand2, RefreshCw, Loader2, Check, AlertCircle } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { api } from '@/api/request'

export type EntityCategory =
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'world_setting'
  | 'rule'

export interface SettingsAIButtonGroupProps {
  /** Required by every endpoint. */
  projectId: number
  /** Selected entity category, e.g. 'character'. */
  entityType?: EntityCategory
  /** Selected entity id (omit for "generate new entity"). */
  entityId?: number
  /** Hint string for entity generation (e.g. "落魄剑修"). */
  hint?: string
  /** Rewrite style — only used by the rewrite-description button. */
  rewriteStyle?: 'concise' | 'literary' | 'classical' | 'humorous' | 'mysterious'
  /** Empty field names — only used by the fill-fields button. */
  emptyFields?: string[]
  /** Override the default action labels / disable individual buttons. */
  disabledActions?: ReadonlyArray<ActionKey>
  /** Called after a successful AI call with the raw response payload. */
  onResult?: (action: ActionKey, data: unknown) => void
}

export type ActionKey = 'generate-entity' | 'review-consistency' | 'fill-fields' | 'rewrite-description'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface ActionDescriptor {
  key: ActionKey
  label: string
  description: string
  endpoint: string
  icon: typeof Sparkles
  /** True when no entity must be selected (generation creates a new one). */
  standalone: boolean
}

const ACTIONS: ActionDescriptor[] = [
  {
    key: 'generate-entity',
    label: '生成实体',
    description: '基于提示生成新的实体条目',
    endpoint: '/ai/generate-entity',
    icon: Sparkles,
    standalone: true,
  },
  {
    key: 'review-consistency',
    label: '审查一致性',
    description: '检查所有实体的逻辑一致性',
    endpoint: '/ai/review-consistency',
    icon: ShieldCheck,
    standalone: true,
  },
  {
    key: 'fill-fields',
    label: '填充字段',
    description: '补全当前实体的空白字段',
    endpoint: '/ai/fill-fields',
    icon: Wand2,
    standalone: false,
  },
  {
    key: 'rewrite-description',
    label: '改写描述',
    description: '按指定风格重写实体描述',
    endpoint: '/ai/rewrite-description',
    icon: RefreshCw,
    standalone: false,
  },
]

/** Append a structured record to the canonical AI log (US-018). */
async function emitAILog(payload: Record<string, unknown>): Promise<void> {
  if (typeof window === 'undefined') return
  const api = window.electronAPI
  if (!api || typeof api.appendAILog !== 'function') return
  try {
    await api.appendAILog({
      timestamp: new Date().toISOString(),
      action: payload.action,
      prompt: payload.prompt ?? null,
      response: payload.response ?? null,
      latencyMs: payload.latencyMs ?? null,
      tokenCount: payload.tokenCount ?? null,
      journeyId: payload.journeyId ?? null,
      stageId: payload.stageId ?? `settings-${payload.action}`,
      correlationId: payload.correlationId ?? null,
    })
  } catch (err) {
    // Logging is best-effort; never throw into the UI layer.
     
    console.warn('[SettingsAIButtonGroup] appendAILog failed', err)
  }
}

function buildRequestBody(
  action: ActionKey,
  props: SettingsAIButtonGroupProps
): Record<string, unknown> {
  switch (action) {
    case 'generate-entity':
      return {
        type: props.entityType ?? 'character',
        hint: props.hint ?? '',
        projectId: props.projectId,
      }
    case 'review-consistency':
      return {
        projectId: props.projectId,
        targetTypes: props.entityType ? [props.entityType] : undefined,
      }
    case 'fill-fields':
      return {
        entityType: props.entityType ?? 'character',
        entityId: props.entityId ?? 0,
        emptyFields: props.emptyFields ?? [],
      }
    case 'rewrite-description':
      return {
        entityType: props.entityType ?? 'character',
        entityId: props.entityId ?? 0,
        style: props.rewriteStyle ?? 'literary',
      }
  }
}

export function SettingsAIButtonGroup(props: SettingsAIButtonGroupProps) {
  const { projectId, entityId, entityType, disabledActions, onResult } = props
  const [statuses, setStatuses] = useState<Record<ActionKey, Status>>({
    'generate-entity': 'idle',
    'review-consistency': 'idle',
    'fill-fields': 'idle',
    'rewrite-description': 'idle',
  })
  const [errors, setErrors] = useState<Record<ActionKey, string | null>>({
    'generate-entity': null,
    'review-consistency': null,
    'fill-fields': null,
    'rewrite-description': null,
  })

  const setStatus = useCallback((key: ActionKey, status: Status, errorMsg: string | null = null) => {
    setStatuses((prev) => ({ ...prev, [key]: status }))
    setErrors((prev) => ({ ...prev, [key]: errorMsg }))
  }, [])

  const handleClick = useCallback(
    async (action: ActionDescriptor) => {
      if (!projectId) {
        setStatus(action.key, 'error', '缺少 projectId')
        return
      }
      if (!action.standalone && (!entityType || !entityId)) {
        setStatus(action.key, 'error', '请先选择一个实体')
        return
      }

      setStatus(action.key, 'loading')
      const startedAt = Date.now()
      try {
        const body = buildRequestBody(action.key, props)
        const data = (await api.post(action.endpoint, body)) as { data?: unknown }
        const latencyMs = Date.now() - startedAt
        setStatus(action.key, 'success')
        onResult?.(action.key, data)
        await emitAILog({
          action: action.key,
          prompt: body,
          response: data,
          latencyMs,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI 调用失败'
        setStatus(action.key, 'error', msg)
        await emitAILog({
          action: action.key,
          prompt: buildRequestBody(action.key, props),
          response: { error: msg },
          latencyMs: Date.now() - startedAt,
        })
      }
    },
    [projectId, entityType, entityId, props, onResult, setStatus]
  )

  const disabled = new Set(disabledActions ?? [])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        <Icon icon={Sparkles} size="sm" color="accent" />
        AI 助手
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">
        在设定编辑器中触发实体级 AI 操作（每次调用会写入 AI 日志，便于 e2e 追踪）。
      </p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        {ACTIONS.map((action) => {
          const status = statuses[action.key]
          const errorMsg = errors[action.key]
          const isLoading = status === 'loading'
          const isDisabled =
            disabled.has(action.key) ||
            isLoading ||
            !projectId ||
            (!action.standalone && (!entityType || !entityId))
          return (
            <button
              key={action.key}
              type="button"
              data-testid={`ai-button-${action.key}`}
              onClick={() => handleClick(action)}
              disabled={isDisabled}
              title={action.description}
              className="flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left text-xs transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:scale-[1.01] enabled:active:scale-[0.99]"
              style={{
                background: 'var(--color-surface-overlay)',
                borderColor:
                  status === 'error'
                    ? 'var(--color-error)'
                    : status === 'success'
                      ? 'var(--color-ifline)'
                      : 'var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-1.5 w-full">
                {isLoading ? (
                  <Icon icon={Loader2} size="xs" className="animate-spin" />
                ) : status === 'success' ? (
                  <Icon icon={Check} size="xs" color="success" />
                ) : status === 'error' ? (
                  <Icon icon={AlertCircle} size="xs" color="danger" />
                ) : (
                  <Icon icon={action.icon} size="xs" color="accent" />
                )}
                <span className="font-medium text-[var(--text-primary)] flex-1">{action.label}</span>
              </div>
              <span className="text-[10px] text-[var(--text-tertiary)] leading-tight">
                {status === 'error' && errorMsg ? errorMsg : action.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SettingsAIButtonGroup
