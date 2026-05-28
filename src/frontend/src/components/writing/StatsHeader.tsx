import { Zap, ChevronUp, ChevronDown } from 'lucide-react'

interface StatsHeaderProps {
  expanded: boolean
  onToggleExpanded: () => void
  onToggleVisible: () => void
}

export function StatsHeader({ expanded, onToggleExpanded, onToggleVisible }: StatsHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 cursor-pointer"
      style={{
        borderBottom: '1px solid color-mix(in srgb, var(--paper-100) 4%, transparent)',
        background: `linear-gradient(180deg, color-mix(in srgb, var(--paper-100) 2%, transparent) 0%, transparent 100%)`,
      }}
      onClick={onToggleExpanded}
    >
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3" style={{ color: 'var(--color-character)' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>写作统计</span>
      </div>
      <div className="flex items-center gap-0.5">
        {expanded ? (
          <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronUp className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleVisible()
          }}
          className="ml-1 w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-[color-mix(in_srgb,var(--paper-100)_6%,transparent)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <span className="text-[10px]">&times;</span>
        </button>
      </div>
    </div>
  )
}
