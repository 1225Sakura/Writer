import { HumanAIRatioSlider } from '@/components/ui/HumanAIRatioSlider'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { Bot, Sparkles, User } from 'lucide-react'

interface RatioSliderSectionProps {
  humanAIRatio: number
  setHumanAIRatio: (ratio: number) => void
}

export function RatioSliderSection({ humanAIRatio, setHumanAIRatio }: RatioSliderSectionProps) {
  const modeInfo =
    humanAIRatio < 30
      ? { label: 'AI主导', icon: <Bot className="w-3 h-3" />, color: 'var(--accent-100)', desc: 'AI自动推进剧情，用户偶尔介入调整' }
      : humanAIRatio < 70
        ? { label: '协作模式', icon: <Sparkles className="w-3 h-3" />, color: 'var(--color-ifline)', desc: '人机共同创作，AI辅助用户写作' }
        : { label: '用户主导', icon: <User className="w-3 h-3" />, color: 'var(--color-character)', desc: '用户主导创作，AI仅按指令辅助' }

  return (
    <div className="space-y-3">
      <HumanAIRatioSlider
        value={humanAIRatio}
        onChange={setHumanAIRatio}
      />

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