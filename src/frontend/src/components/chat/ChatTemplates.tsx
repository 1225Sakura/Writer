import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ChevronDown, Sword, Rocket, Mountain, Building2, Search } from 'lucide-react'

export interface ChatTemplate {
  id: string
  label: string
  icon: React.ReactNode
  message: string
}

const templates: ChatTemplate[] = [
  {
    id: 'fantasy',
    label: '奇幻世界观',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    message: '我想创作一个奇幻世界观的故事。请帮我构建一个包含魔法体系、种族设定、大陆地理和主要势力的完整世界观。',
  },
  {
    id: 'scifi',
    label: '科幻设定',
    icon: <Rocket className="w-3.5 h-3.5" />,
    message: '我想写一个科幻故事。请帮我设计未来科技体系、星际文明、社会结构和核心科幻概念。',
  },
  {
    id: 'wuxia',
    label: '武侠江湖',
    icon: <Sword className="w-3.5 h-3.5" />,
    message: '我想创作武侠小说。请帮我构建江湖门派体系、武功秘籍、恩怨情仇和主角身世背景。',
  },
  {
    id: 'urban',
    label: '都市异能',
    icon: <Building2 className="w-3.5 h-3.5" />,
    message: '我想写都市异能题材。请帮我设计异能体系、主角能力、势力组织和现代都市背景。',
  },
  {
    id: 'mystery',
    label: '悬疑推理',
    icon: <Search className="w-3.5 h-3.5" />,
    message: '我想写悬疑推理小说。请帮我设计案件谜题、侦探角色、嫌疑人关系和关键线索布局。',
  },
]

interface ChatTemplatesProps {
  onSelect: (message: string) => void
  disabled?: boolean
}

export function ChatTemplates({ onSelect, disabled }: ChatTemplatesProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (template: ChatTemplate) => {
    onSelect(template.message)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[rgba(255,255,255,0.08)]
                   text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f7f8f8]
                   active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Mountain className="w-3.5 h-3.5" />
        <span>快速开始</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3 h-3" />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-lg border border-[rgba(255,255,255,0.08)]
                         bg-[#0f1011] shadow-xl overflow-hidden"
            >
              <div className="p-2">
                <div className="text-xs text-[#d0d6e0] px-2 py-1.5 font-medium">
                  选择故事类型
                </div>
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className="w-full flex items-center gap-2 px-2 py-2 text-sm text-[#f7f8f8] rounded-md
                               hover:bg-[rgba(255,255,255,0.06)] transition-colors text-left"
                  >
                    <span className="text-[#5e6ad2]">{template.icon}</span>
                    <span>{template.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
