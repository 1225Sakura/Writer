import { useWritingStore } from '@/store'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'
import { memo } from 'react'
import {
  Bot,
  User,
} from 'lucide-react'

export function RatioSliderSection() {
  const { humanAIRatio, setHumanAIRatio } = useWritingStore()

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
        <RatioSlider
          value={[humanAIRatio]}
          min={0}
          max={100}
          step={10}
          onValueChange={(value) => setHumanAIRatio(value[0])}
        />
      </div>
      <User className="w-3.5 h-3.5 text-[var(--icon-secondary)]" />
      <span
        className="text-[10px] w-9 text-center font-semibold tracking-wide tabular-nums"
        style={{
          color: humanAIRatio < 30
            ? 'var(--accent-primary)'
            : humanAIRatio < 70
              ? 'var(--color-ifline)'
              : 'var(--color-character)',
        }}
      >
        {humanAIRatio < 30 ? 'AI' : humanAIRatio < 70 ? '协作' : '用户'}
      </span>
    </div>
  )
}

const RatioSlider = memo(function RatioSlider({
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
