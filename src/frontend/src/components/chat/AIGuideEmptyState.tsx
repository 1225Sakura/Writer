/**
 * AIGuideEmptyState - Empty state for the AI guide panel
 *
 * Shows welcome message, genre tags, example question cards, and tips when no messages exist.
 * Example questions are categorized (world-building, character creation, plot design)
 * and auto-send via setPendingInput on click.
 */

import { Sparkles, MessageSquareText, Wand2, Lightbulb, PenTool, Globe, Users, BookOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE, STAGGER_CONTAINER, STAGGER_ITEM } from '@/components/shared/AnimationConfig'
import { useChatStore } from '@/store/chatStore'

/* ============================================================
   EXAMPLE QUESTIONS - Categorized by type
   ============================================================ */

interface ExampleQuestion {
  id: string
  category: string
  categoryIcon: React.ElementType
  question: string
  message: string
}

const exampleQuestions: ExampleQuestion[] = [
  {
    id: 'world-1',
    category: '世界观',
    categoryIcon: Globe,
    question: '帮我构建一个修仙世界的设定',
    message: '我想写一部玄幻修仙小说，请帮我构建一个完整的世界观设定，包括修炼体系、境界划分和世界地理。',
  },
  {
    id: 'world-2',
    category: '世界观',
    categoryIcon: Globe,
    question: '设计一个末日废土的世界背景',
    message: '请帮我设计一个末日废土类型的世界背景，包括灾难起因、幸存者聚落和资源体系。',
  },
  {
    id: 'character-1',
    category: '角色',
    categoryIcon: Users,
    question: '帮我设计一个有深度的主角',
    message: '请帮我设计一个有深度的主角，包括性格特征、成长弧线、内心矛盾和独特的能力。',
  },
  {
    id: 'character-2',
    category: '角色',
    categoryIcon: Users,
    question: '创造一组性格鲜明的配角团',
    message: '请帮我创造一组性格鲜明的配角团队，每个人都要有独特的背景故事和与主角的羁绊。',
  },
  {
    id: 'plot-1',
    category: '情节',
    categoryIcon: BookOpen,
    question: '帮我构思一个引人入胜的开头',
    message: '请帮我构思一个引人入胜的小说开头，要有悬念钩子，能让读者在前三章就沉浸进去。',
  },
]

/* ============================================================
   COMPONENT
   ============================================================ */

export function AIGuideEmptyState() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const setPendingInput = useChatStore((s) => s.setPendingInput)

  const handleExampleClick = (question: ExampleQuestion) => {
    setPendingInput(question.message)
  }

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6 relative overflow-y-auto scrollbar-thin"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: DURATION.FAST } : { duration: DURATION.SLOW, ease: EASE.STANDARD }}
    >
      <motion.div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-6 mt-8"
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.FAST } : { delay: 0.1, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        <GlassCard
          intensity="medium"
          border="subtle"
          variant="elevated"
          rounded="2xl"
          padding="none"
          className="w-full h-full flex items-center justify-center"
        >
          <Sparkles className="w-9 h-9 text-accent-primary" />
        </GlassCard>
        {!prefersReducedMotion && (
          <motion.div
            className="absolute -inset-1 rounded-2xl border border-accent-primary/20"
            animate={{ scale: [1, 1.06, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <motion.div
          className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-accent-primary"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.h2
        className="text-xl font-medium mb-2 text-primary"
        initial={prefersReducedMotion ? {} : { y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.INSTANT } : { delay: 0.15, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        欢迎使用自动化写作软件
      </motion.h2>

      <motion.p
        className="text-sm text-secondary mb-5 max-w-xs"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.INSTANT } : { delay: 0.18, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        让 AI 陪你从零搭建故事世界，设定角色，构思情节
      </motion.p>

      <motion.div
        className="inline-flex items-center gap-2 mb-5"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.INSTANT } : { delay: 0.2, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-strong to-transparent" />
        <span className="inline-flex items-center gap-1.5 text-xs text-tertiary">
          <span className="flex-shrink-0"><Wand2 className="w-3 h-3" /></span>
          <span>选择下方标签快速开始，或直接输入你的想法</span>
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border-strong to-transparent" />
      </motion.div>

      <motion.div
        className="flex flex-wrap justify-center gap-2.5 mb-6"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.INSTANT } : { delay: 0.25, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        {['玄幻修仙', '都市异能', '悬疑推理', '言情', '科幻未来', '历史穿越'].map((tag) => (
          <GlassCard
            key={tag}
            intensity="light"
            border="subtle"
            variant="default"
            rounded="xl"
            padding="sm"
            hover
            className="inline-flex items-center gap-1.5 text-sm cursor-pointer text-secondary hover:text-primary"
            style={{ whiteSpace: 'nowrap' }}
          >
            <span className="flex-shrink-0 opacity-60"><MessageSquareText className="w-3.5 h-3.5" /></span>
            <span>{tag}</span>
          </GlassCard>
        ))}
      </motion.div>

      {/* Example question cards */}
      <motion.div
        className="w-full max-w-sm mb-6"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: DURATION.INSTANT } : { delay: 0.3, duration: DURATION.SLOW, ease: EASE.STANDARD }}
      >
        <div className="flex items-center gap-2 mb-3 px-1">
          <Sparkles className="w-3.5 h-3.5 text-accent-primary/70" />
          <span className="text-xs text-tertiary font-medium">试试这些问题</span>
        </div>
        <motion.div
          className="space-y-2"
          variants={prefersReducedMotion ? {} : STAGGER_CONTAINER}
          initial="hidden"
          animate="visible"
        >
          {exampleQuestions.map((q) => {
            const CategoryIcon = q.categoryIcon
            return (
              <motion.div
                key={q.id}
                variants={prefersReducedMotion ? {} : STAGGER_ITEM}
              >
                <GlassCard
                  intensity="light"
                  border="subtle"
                  variant="default"
                  rounded="lg"
                  padding="sm"
                  hover
                  className="flex items-start gap-3 cursor-pointer group"
                  onClick={() => handleExampleClick(q)}
                >
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5
                                  bg-accent-primary/10 group-hover:bg-accent-primary/20 transition-colors">
                    <CategoryIcon className="w-3 h-3 text-accent-primary/70" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="text-[10px] text-accent-primary/60 block mb-0.5">{q.category}</span>
                    <span className="text-xs text-secondary group-hover:text-primary transition-colors leading-relaxed">
                      {q.question}
                    </span>
                  </div>
                  <PenTool className="w-3 h-3 text-tertiary/40 flex-shrink-0 mt-1 group-hover:text-accent-primary/60 transition-colors" />
                </GlassCard>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.div>

      {/* Tips section */}
      <motion.div
        className="w-full max-w-sm mb-8"
        initial={prefersReducedMotion ? {} : { y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.1 } : { delay: 0.45, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="flex items-center gap-2 mb-3 px-1">
          <Lightbulb className="w-3.5 h-3.5 text-accent-primary/70" />
          <span className="text-xs text-tertiary font-medium">小贴士</span>
        </div>
        <div className="space-y-2">
          {[
            { icon: PenTool, text: '描述你的世界设定，AI 会自动提取关键信息' },
            { icon: Sparkles, text: '随时点击已收集的设定进行确认或修改' },
            { icon: Wand2, text: '完成设定后可进入编辑器开始正式写作' },
          ].map((tip) => (
            <GlassCard
              key={tip.text}
              intensity="light"
              border="subtle"
              variant="default"
              rounded="lg"
              padding="sm"
              className="flex items-start gap-3"
            >
              <tip.icon className="w-4 h-4 text-accent-primary/60 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-secondary leading-relaxed text-left">{tip.text}</span>
            </GlassCard>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
