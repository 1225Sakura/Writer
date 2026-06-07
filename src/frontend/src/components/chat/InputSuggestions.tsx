import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Wand2, Lightbulb, FileText, Sparkles, BookOpen, Users, Swords, MapPin, Settings, PenTool, Rocket, Search, Heart, Ghost } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { ChatTemplates } from './ChatTemplates'
import { GlassCard } from '@/components/ui/GlassCard'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useChatStore } from '@/store/chatStore'
import type { ExtractedEntityLocal } from '@/store/chatStore'

/* ============================================================
   CONTEXT-AWARE STAGE SUGGESTIONS
   ============================================================ */

interface StageSuggestion {
  label: string
  icon: React.ReactNode
  message: string
}

function getStageSuggestions(entities: ExtractedEntityLocal[]): StageSuggestion[] | null {
  const types = new Set(entities.map((e) => e.type))

  // No entities at all → genre suggestions
  if (entities.length === 0) {
    return [
      { label: '玄幻修仙', icon: <Sparkles className="w-3.5 h-3.5" />, message: '我想创作一个玄幻修仙故事，请帮我构建世界观和修炼体系。' },
      { label: '都市异能', icon: <Rocket className="w-3.5 h-3.5" />, message: '我想写都市异能题材，请帮我设计异能体系和主角能力。' },
      { label: '悬疑推理', icon: <Search className="w-3.5 h-3.5" />, message: '我想写悬疑推理小说，请帮我设计案件谜题和侦探角色。' },
      { label: '言情', icon: <Heart className="w-3.5 h-3.5" />, message: '我想写言情小说，请帮我设计男女主角人设和感情线。' },
      { label: '恐怖灵异', icon: <Ghost className="w-3.5 h-3.5" />, message: '我想写恐怖灵异小说，请帮我设计恐怖元素和灵异规则。' },
    ]
  }

  // Has genre-related entities but no explicit world → world-building suggestions
  const hasWorld = types.has('world') || types.has('rule')
  if (!hasWorld) {
    return [
      { label: '补充世界观', icon: <BookOpen className="w-3.5 h-3.5" />, message: '请帮我补充完善世界观设定，包括地理、历史和文明。' },
      { label: '描述世界规则', icon: <Settings className="w-3.5 h-3.5" />, message: '请帮我描述这个世界的运行规则和底层逻辑。' },
      { label: '设定力量体系', icon: <Sparkles className="w-3.5 h-3.5" />, message: '请帮我设计完整的力量/修炼/技能体系。' },
    ]
  }

  // Has world but no characters → character suggestions
  const hasCharacter = types.has('character')
  if (!hasCharacter) {
    return [
      { label: '创建主角', icon: <Users className="w-3.5 h-3.5" />, message: '请帮我创建主角，包括姓名、性格、能力和成长弧线。' },
      { label: '设计反派', icon: <Swords className="w-3.5 h-3.5" />, message: '请帮我设计反派角色，包括动机、能力和与主角的关系。' },
      { label: '添加配角', icon: <Users className="w-3.5 h-3.5" />, message: '请帮我添加重要配角，包括盟友、导师和关键NPC。' },
    ]
  }

  // Has characters but no plot-related content (no faction/location or few entities) → plot suggestions
  const hasLocation = types.has('location')
  const hasFaction = types.has('faction')
  if (!hasLocation && !hasFaction) {
    return [
      { label: '设计主线', icon: <PenTool className="w-3.5 h-3.5" />, message: '请帮我设计故事主线剧情，包括开端、发展和高潮。' },
      { label: '添加冲突', icon: <Swords className="w-3.5 h-3.5" />, message: '请帮我设计核心冲突和矛盾，推动故事发展。' },
      { label: '规划高潮', icon: <Sparkles className="w-3.5 h-3.5" />, message: '请帮我规划故事高潮和转折点。' },
      { label: '添加地点', icon: <MapPin className="w-3.5 h-3.5" />, message: '请帮我添加重要的故事发生地点。' },
      { label: '设计势力', icon: <Swords className="w-3.5 h-3.5" />, message: '请帮我设计故事中的势力组织和阵营。' },
    ]
  }

  // Well-populated → no special suggestions, show quick replies as usual
  return null
}

/* ============================================================
   QUICK REPLIES
   ============================================================ */

const quickReplies = [
  { label: '继续', icon: <Icon icon={Zap} size="xs" />, message: '继续' },
  { label: '详细点', icon: <Icon icon={Wand2} size="xs" />, message: '请说得更详细一些' },
  { label: '换个思路', icon: <Icon icon={Lightbulb} size="xs" />, message: '换个思路' },
]

/* ============================================================
   COMPONENT
   ============================================================ */

interface InputSuggestionsProps {
  hasMessages: boolean
  isLoading: boolean
  isStreaming: boolean
  showExportConfirm: boolean
  onTemplateSelect: (message: string) => void
  onQuickReply: (message: string) => void
  onExportOutline: () => void
}

export function InputSuggestions({
  hasMessages,
  isLoading,
  isStreaming,
  showExportConfirm,
  onTemplateSelect,
  onQuickReply,
  onExportOutline,
}: InputSuggestionsProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const extractedEntities = useChatStore((state) => state.extractedEntities)

  const stageSuggestions = useMemo(
    () => getStageSuggestions(extractedEntities),
    [extractedEntities],
  )

  return (
    <>
      {/* Context-aware stage suggestions */}
      <AnimatePresence mode="wait">
        {stageSuggestions && !isLoading && !isStreaming && (
          <motion.div
            key="stage-suggestions"
            className="flex flex-wrap gap-1.5"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
          >
            {stageSuggestions.map((suggestion) => (
              <GlassCard
                key={suggestion.label}
                intensity="light"
                border="subtle"
                variant="default"
                rounded="full"
                padding="sm"
                hover
                className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-secondary hover:text-primary"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => onQuickReply(suggestion.message)}
              >
                <span className="flex-shrink-0 opacity-70">{suggestion.icon}</span>
                <span>{suggestion.label}</span>
              </GlassCard>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template selector + Export button row */}
      <div className="flex items-center justify-between">
        <ChatTemplates onSelect={onTemplateSelect} disabled={isLoading || isStreaming} />

        {hasMessages && (
          <motion.button
            onClick={onExportOutline}
            disabled={isLoading || isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-default
                       text-secondary hover:bg-surface-raised hover:text-primary
                       active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed touch-target-min"
            whileHover={prefersReducedMotion ? {} : { y: -1, boxShadow: 'var(--shadow-card)' }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
          >
            <Icon icon={FileText} size="sm" />
            <span>生成大纲</span>
          </motion.button>
        )}
      </div>

      {/* Export confirmation toast */}
      <AnimatePresence>
        {showExportConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg
                       bg-[color-mix(in_srgb,var(--color-ifline)_10%,transparent)] text-[var(--color-ifline)] border border-[color-mix(in_srgb,var(--color-ifline)_20%,transparent)]"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </motion.div>
            大纲已生成！请前往设定界面查看。
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick reply buttons */}
      <AnimatePresence>
        {hasMessages && !stageSuggestions && !isLoading && !isStreaming && (
          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
          >
            {quickReplies.map((reply) => (
              <GlassCard
                key={reply.label}
                intensity="light"
                border="subtle"
                variant="default"
                rounded="full"
                padding="sm"
                hover
                className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-secondary hover:text-primary"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => onQuickReply(reply.message)}
              >
                <span className="flex-shrink-0 opacity-60">{reply.icon}</span>
                <span>{reply.label}</span>
              </GlassCard>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
