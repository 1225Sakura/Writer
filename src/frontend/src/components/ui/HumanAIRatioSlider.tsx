import { Slider } from '@/components/ui/slider'

interface HumanAIRatioSliderProps {
  value: number
  onChange: (value: number) => void
}

export function HumanAIRatioSlider({ value, onChange }: HumanAIRatioSliderProps) {
  return (
    <div className="space-y-2">
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        max={100}
        step={1}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-tertiary">
        <span>AI主导</span>
        <span>{value}%</span>
        <span>人工</span>
      </div>
    </div>
  )
}
