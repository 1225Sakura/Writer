import { useAIStore } from '@/store'
import { Users } from 'lucide-react'

export function PanelHeader() {
  const { loading } = useAIStore()
  const isOnline = !loading.ai

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-ifline) 18%, transparent) 0%, color-mix(in srgb, var(--color-ifline) 8%, transparent) 100%)',
              border: '1px solid color-mix(in srgb, var(--color-ifline) 25%, transparent)',
            }}
          >
            <Users className="w-5 h-5 text-[var(--color-ifline)]" />
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: 'var(--color-surface-raised)',
              background: isOnline ? 'var(--color-ifline)' : 'var(--color-vermillion)',
            }}
          >
            {isOnline && (
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-40 motion-reduce:animate-none"
                style={{ background: 'var(--color-ifline)', animationDuration: '2s' }}
              />
            )}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>协作面板</span>
          <div className="text-[10px] leading-tight flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: isOnline ? 'var(--color-ifline)' : 'var(--color-vermillion)',
                boxShadow: isOnline ? '0 0 4px var(--color-ifline)' : 'none',
              }}
            />
            <span style={{ color: 'var(--text-tertiary)' }}>
              {isOnline ? '在线同步中' : '同步暂停'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}