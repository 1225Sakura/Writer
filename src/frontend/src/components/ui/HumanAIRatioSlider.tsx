import { Slider } from '@/components/ui/slider'
import { Bot, User, Sparkles } from 'lucide-react'

interface HumanAIRatioSliderProps {
  value: number
  onChange: (value: number) => void
}

export function HumanAIRatioSlider({ value, onChange }: HumanAIRatioSliderProps) {
  const getTrackGradient = () => {
    if (value < 30) return 'linear-gradient(90deg, #5e6ad2 0%, #6b77e0 100%)'
    if (value < 70) return 'linear-gradient(90deg, #5e6ad2 0%, #7eb84a 100%)'
    return 'linear-gradient(90deg, #7eb84a 0%, #e8b87d 100%)'
  }

  const getModeIcon = () => {
    if (value < 30) return <Bot className="w-3.5 h-3.5" />
    if (value < 70) return <Sparkles className="w-3.5 h-3.5" />
    return <User className="w-3.5 h-3.5" />
  }

  const getModeLabel = () => {
    if (value < 30) return 'AI主导'
    if (value < 70) return '协作'
    return '人工主导'
  }

  const getModeColor = () => {
    if (value < 30) return '#5e6ad2'
    if (value < 70) return '#7eb84a'
    return '#e8b87d'
  }

  return (
    <div className="space-y-4">
      {/* Custom styled slider wrapper with glow effect */}
      <div className="relative px-1 py-3">
        {/* Glow effect under the filled track */}
        <div
          className="absolute top-1/2 left-0 h-2 rounded-full pointer-events-none -translate-y-1/2 transition-all duration-200 ease-out"
          style={{
            width: `calc(${value}% - 8px)`,
            background: getTrackGradient(),
            filter: 'blur(6px)',
            marginLeft: '4px',
            opacity: 0.5,
          }}
        />

        <Slider
          value={[value]}
          onValueChange={(v) => onChange(v[0])}
          max={100}
          step={1}
          className="w-full"
        />
      </div>

      {/* Labels with icons and improved styling */}
      <div className="flex justify-between items-center px-1">
        <span
          className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-300 ${
            value < 30 ? 'text-[#5e6ad2]' : 'text-[var(--text-tertiary)]'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>AI</span>
        </span>

        {/* Center percentage badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-300"
          style={{
            backgroundColor: `${getModeColor()}15`,
            color: getModeColor(),
            boxShadow: `0 0 12px ${getModeColor()}25`,
          }}
        >
          {getModeIcon()}
          <span>{value}%</span>
        </div>

        <span
          className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-300 ${
            value >= 70 ? 'text-[#e8b87d]' : 'text-[var(--text-tertiary)]'
          }`}
        >
          <span>人工</span>
          <User className="w-4 h-4" />
        </span>
      </div>

      {/* Mode label below */}
      <div className="text-center">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded transition-all duration-300"
          style={{
            backgroundColor: `${getModeColor()}12`,
            color: getModeColor(),
          }}
        >
          {getModeLabel()}
        </span>
      </div>
    </div>
  )
}
