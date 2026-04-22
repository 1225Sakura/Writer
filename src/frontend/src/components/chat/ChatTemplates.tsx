import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  ChevronDown,
  Sword,
  Rocket,
  Mountain,
  Building2,
  Search,
  BookOpen,
  Heart,
  Clock,
  Ghost,
} from 'lucide-react'

export interface ChatTemplate {
  id: string
  label: string
  icon: React.ReactNode
  message: string
  description: string
  color: string
}

const templates: ChatTemplate[] = [
  {
    id: 'fantasy',
    label: '奇幻世界观',
    icon: <Sparkles className="w-4 h-4" />,
    message: '我想创作一个奇幻世界观的故事。请帮我构建一个包含魔法体系、种族设定、大陆地理和主要势力的完整世界观。',
    description: '魔法、种族、大陆、势力',
    color: '#9b7ed9',
  },
  {
    id: 'scifi',
    label: '科幻设定',
    icon: <Rocket className="w-4 h-4" />,
    message: '我想写一个科幻故事。请帮我设计未来科技体系、星际文明、社会结构和核心科幻概念。',
    description: '科技、星际、文明、社会',
    color: '#5b8ee8',
  },
  {
    id: 'wuxia',
    label: '武侠江湖',
    icon: <Sword className="w-4 h-4" />,
    message: '我想创作武侠小说。请帮我构建江湖门派体系、武功秘籍、恩怨情仇和主角身世背景。',
    description: '门派、武功、恩怨、身世',
    color: '#c45c5c',
  },
  {
    id: 'urban',
    label: '都市异能',
    icon: <Building2 className="w-4 h-4" />,
    message: '我想写都市异能题材。请帮我设计异能体系、主角能力、势力组织和现代都市背景。',
    description: '异能、能力、势力、都市',
    color: '#5eb5a6',
  },
  {
    id: 'mystery',
    label: '悬疑推理',
    icon: <Search className="w-4 h-4" />,
    message: '我想写悬疑推理小说。请帮我设计案件谜题、侦探角色、嫌疑人关系和关键线索布局。',
    description: '谜题、侦探、嫌疑人、线索',
    color: '#e8b87d',
  },
  {
    id: 'romance',
    label: '言情',
    icon: <Heart className="w-4 h-4" />,
    message: '我想写言情小说。请帮我设计男女主角人设、相遇契机、感情发展和阻碍因素。',
    description: '人设、相遇、感情、阻碍',
    color: '#d45d5d',
  },
  {
    id: 'history',
    label: '历史穿越',
    icon: <Clock className="w-4 h-4" />,
    message: '我想写历史穿越小说。请帮我选择历史时期、设计穿越方式、主角身份和改变历史的契机。',
    description: '历史、穿越、身份、契机',
    color: '#7eb84a',
  },
  {
    id: 'horror',
    label: '恐怖灵异',
    icon: <Ghost className="w-4 h-4" />,
    message: '我想写恐怖灵异小说。请帮我设计恐怖元素、灵异规则、主角遭遇和世界观设定。',
    description: '恐怖、灵异、规则、遭遇',
    color: '#8b7ed9',
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
      <motion.button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[rgba(255,255,255,0.08)]
                   text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f7f8f8]
                   active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
      >
        <Mountain className="w-3.5 h-3.5" />
        <span>快速开始</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronDown className="w-3 h-3" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-full left-0 mb-2 z-50 w-72 rounded-xl border border-[rgba(255,255,255,0.08)]
                         shadow-2xl overflow-hidden"
              style={{ backgroundColor: '#0f1011' }}
            >
              {/* Header */}
              <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.04)]">
                <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  选择故事类型
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  AI 将据此引导你完成世界观构建
                </div>
              </div>

              {/* Template grid */}
              <div className="p-2 grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
                {templates.map((template, i) => (
                  <motion.button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className="flex flex-col gap-1.5 p-2.5 rounded-lg text-left group"
                    style={{
                      backgroundColor: 'transparent',
                    }}
                    whileHover={{
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      scale: 1.02,
                    }}
                    whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2">
                      <motion.div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: `${template.color}15`,
                          border: `1px solid ${template.color}25`,
                        }}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ duration: 0.15 }}
                      >
                        <span style={{ color: template.color }}>{template.icon}</span>
                      </motion.div>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {template.label}
                      </span>
                    </div>
                    <span className="text-[10px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
                      {template.description}
                    </span>
                  </motion.button>
                ))}
              </div>

              {/* Footer hint */}
              <div className="px-3 py-2 border-t border-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                  <BookOpen className="w-3 h-3" />
                  <span>也可以直接输入你的想法</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
