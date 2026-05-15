import { useWritingStore } from '@/store'
import { HumanAIRatioSlider } from '@/components/ui/HumanAIRatioSlider'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { CollapsibleSection } from '@/components/writing/collaboration/CollapsibleSection'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'
import { memo, type ReactNode } from 'react'
import { Bot, Sparkles, User } from 'lucide-react'

/* ============================================================
   TYPES
   ============================================================ */

interface RatioSliderSectionProps {
  /** Visual variant: compact inline slider or full with mode description */
  variant?: 'compact' | 'full'
  /** Override value from store (operations drawer passes props directly) */
  humanAIRatio?: number
  /** Override setter from store */
  setHumanAIRatio?: (ratio: number) => void
  /** Wrap in CollapsibleSection (collaboration panel) */
  collapsible?: boolean
  /** CollapsibleSection title */
  title?: string
  /** CollapsibleSection icon */
  icon?: ReactNode
}

/* ============================================================
   COMPACT VARIANT — inline slider for toolbar
   ============================================================ */

function CompactRatioSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg"
      style={{
        background: 'color-mix(in srgb, var(--color-surface-raised) 80%, transparent)',
        border: '1px solid color-mix(in srgb, var(--border-default) 40%, transparent)',
      }}
    >
      <Bot className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
      <div className="w-24">
        <RawSlider
          value={[value]}
          min={0}
          max={100}
          step={10}
          onValueChange={(v) => onChange(v[0])}
        />
      </div>
      <User className="w-3.5 h-3.5 text-[var(--icon-secondary)]" />
      <span
        className="text-[10px] w-9 text-center font-semibold tracking-wide tabular-nums"
        style={{
          color: value < 30
            ? 'var(--accent-primary)'
            : value < 70
              ? 'var(--color-ifline)'
              : 'var(--color-character)',
        }}
      >
        {value < 30 ? 'AI' : value < 70 ? '协作' : '用户'}
      </span>
    </div>
  )
}

const RawSlider = memo(function RawSlider({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex w-full touch-none select-none items-center group/slider',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        className="relative h-1.5 w-full grow overflow-hidden rounded-full"
        style={{
          background: 'var(--border-default)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        <SliderPrimitive.Range
          className="absolute h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--color-ifline) 100%)',
            boxShadow: '0 0 8px color-mix(in srgb, var(--accent-primary) 30%, transparent)',
          }}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block h-5 w-5 rounded-full border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)] disabled:pointer-events-none disabled:opacity-50
                   hover:scale-110 active:scale-95 group-hover/slider:shadow-[0_0_12px_var(--glow-primary)]"
        style={{
          borderColor: 'var(--accent-primary)',
          background: 'var(--color-surface-raised)',
          boxShadow: '0 0 8px color-mix(in srgb, var(--accent-primary) 25%, transparent), 0 2px 4px rgba(0,0,0,0.25)',
        }}
      />
    </SliderPrimitive.Root>
  )
})

/* ============================================================
   FULL VARIANT — HumanAIRatioSlider with mode description
   ============================================================ */

function FullRatioSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const modeInfo =
    value < 30
      ? { label: 'AI主导', icon: <Bot className="w-3 h-3" />, color: 'var(--accent-100)', desc: 'AI自动推进剧情，用户偶尔介入调整' }
      : value < 70
        ? { label: '协作模式', icon: <Sparkles className="w-3 h-3" />, color: 'var(--color-ifline)', desc: '人机共同创作，AI辅助用户写作' }
        : { label: '用户主导', icon: <User className="w-3 h-3" />, color: 'var(--color-character)', desc: '用户主导创作，AI仅按指令辅助' }

  return (
    <div className="space-y-3">
      <HumanAIRatioSlider value={value} onChange={onChange} />

      {/* Mode description */}
      <motion.div
        className="p-2.5 rounded-lg border transition-all duration-200"
        style={{
          backgroundColor: `${modeInfo.color}10`,
          borderColor: `${modeInfo.color}25`,
        }}
        key={modeInfo.label}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span style={{ color: modeInfo.color }}>{modeInfo.icon}</span>
          <span className="text-xs font-medium" style={{ color: modeInfo.color }}>
            {modeInfo.label}
          </span>
        </div>
        <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {modeInfo.desc}
        </div>
      </motion.div>
    </div>
  )
}

/* ============================================================
   CANONICAL EXPORT
   ============================================================ */

export function RatioSliderSection({
  variant = 'full',
  humanAIRatio: propRatio,
  setHumanAIRatio: propSetter,
  collapsible = false,
  title,
  icon,
}: RatioSliderSectionProps) {
  const store = useWritingStore()
  const value = propRatio ?? store.humanAIRatio
  const onChange = propSetter ?? store.setHumanAIRatio

  const content = variant === 'compact'
    ? <CompactRatioSlider value={value} onChange={onChange} />
    : <FullRatioSlider value={value} onChange={onChange} />

  if (collapsible) {
    return (
      <CollapsibleSection
        title={title ?? '人机比例调节'}
        icon={icon ?? <Bot className="w-4 h-4 text-[var(--icon-secondary)]" />}
        isExpanded={true}
        onToggle={() => {}}
      >
        {content}
      </CollapsibleSection>
    )
  }

  return content
}
