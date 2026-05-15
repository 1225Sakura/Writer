/**
 * SprintSettings - Sprint timer settings panel (sprint/break duration sliders)
 */

interface SprintSettingsProps {
  sprintMinutes: number
  breakMinutes: number
  onSprintMinutesChange: (val: number) => void
  onBreakMinutesChange: (val: number) => void
}

export function SprintSettings({
  sprintMinutes,
  breakMinutes,
  onSprintMinutesChange,
  onBreakMinutesChange,
}: SprintSettingsProps) {
  return (
    <div className="px-4 pb-4 pt-3 border-t border-[var(--border-default)] space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]">冲刺时长</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={sprintMinutes}
            onChange={(e) => {
              const val = Number(e.target.value)
              onSprintMinutesChange(val)
            }}
            className="w-20 accent-[var(--accent-primary)]"
            aria-label="冲刺时长"
          />
          <span className="text-xs w-10 text-right text-[var(--text-primary)] tabular-nums">{sprintMinutes}分</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]">休息时长</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={breakMinutes}
            onChange={(e) => {
              const val = Number(e.target.value)
              onBreakMinutesChange(val)
            }}
            className="w-20 accent-[var(--color-ifline)]"
            aria-label="休息时长"
          />
          <span className="text-xs w-10 text-right text-[var(--text-primary)] tabular-nums">{breakMinutes}分</span>
        </div>
      </div>
    </div>
  )
}
