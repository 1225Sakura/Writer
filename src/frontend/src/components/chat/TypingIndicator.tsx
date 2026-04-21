import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[70%] rounded-lg px-4 py-3 bg-[#0f1011] border border-[rgba(255,255,255,0.08)]">
        <div className="flex items-start gap-2">
          <Bot className="w-4 h-4 mt-0.5 text-[#5e6ad2] flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-[#d0d6e0]">AI 正在思考</span>
              <div className="flex gap-0.5 ml-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="inline-block w-1.5 h-1.5 rounded-full bg-[#5e6ad2]"
                    animate={{
                      opacity: [0.3, 1, 0.3],
                      y: [0, -4, 0],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
