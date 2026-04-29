import { useEffect, useState } from 'react'
import { useChatStore, type ExtractedEntity } from '@/store'
import { ChatHeader } from './ChatHeader'
import { ChatArea } from './ChatArea'
import { ChatSidebar } from './ChatSidebar'
import { ChatFooter } from './ChatFooter'
import { UserInputPanel } from './UserInputPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { X, CheckCircle, Circle } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { typeColors } from '@/lib/entityColors'
import { EASE, DURATION, SPRING } from '@/components/shared/AnimationConfig'

/* ============================================================
   MOBILE SIDEBAR CONTENT - Uses GlassCard for entity items
   ============================================================ */

function ChatSidebarMobile({ entities, onConfirmEntity }: {
  entities: ExtractedEntity[]
  onConfirmEntity?: (id: string) => void
}) {
  const groupedEntities = entities.reduce(
    (acc, entity) => {
      const key = entity.type
      if (!acc[key]) acc[key] = []
      acc[key].push(entity)
      return acc
    },
    {} as Record<string, ExtractedEntity[]>
  )

  const confirmedCount = entities.filter((e) => e.confirmed).length
  const progressPercent = entities.length > 0 ? (confirmedCount / entities.length) * 100 : 0

  return (
    <div className="h-full flex flex-col">
      {/* Progress Header */}
      <div className="mb-4 px-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-secondary">
            {confirmedCount}/{entities.length} 项已确认
          </span>
          {progressPercent === 100 && entities.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-ifline)]/10 text-[var(--color-ifline)] border border-[var(--color-ifline)]/20">
              全部确认
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-base">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: progressPercent === 100
                ? 'linear-gradient(90deg, var(--color-ifline), color-mix(in srgb, var(--color-ifline) 70%, var(--accent-primary)))'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: EASE.SMOOTH }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {entities.length === 0 ? (
          <div className="text-center py-8 text-secondary text-sm">
            开始对话后，这里将显示收集到的设定信息
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedEntities).map(([type, typeEntities]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: typeColors[type] || 'var(--color-character)' }}
                  />
                  <span className="text-xs font-medium text-secondary">
                    {type === 'world' ? '世界观' :
                     type === 'character' ? '角色' :
                     type === 'item' ? '物品' :
                     type === 'location' ? '地点' :
                     type === 'faction' ? '势力' :
                     type === 'rule' ? '规则' :
                     type === 'ifline' ? 'IF线' : type}
                  </span>
                  <span className="text-[10px] text-tertiary ml-auto">({typeEntities.length})</span>
                </div>
                <div className="space-y-1.5">
                  {typeEntities.map((entity) => (
                    <GlassCard
                      key={entity.id}
                      intensity="light"
                      border="subtle"
                      variant="default"
                      rounded="md"
                      padding="sm"
                      hover={false}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: typeColors[entity.type] || 'var(--color-character)'
                        }}
                      />
                      <span className="text-sm text-primary flex-1 truncate">{entity.name}</span>
                      {entity.confirmed ? (
                        <CheckCircle className="w-4 h-4 text-[var(--color-ifline)]" />
                      ) : (
                        <button
                          onClick={() => onConfirmEntity?.(entity.id)}
                          className="text-secondary hover:text-primary transition-colors"
                        >
                          <Circle className="w-4 h-4" />
                        </button>
                      )}
                    </GlassCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   CHAT INIT PAGE - Composed from sub-components
   ============================================================ */

export function ChatInitPage() {
  const { extractedEntities, sessionId, createSession, loadExtractedEntities, loadMessages, confirmEntity } = useChatStore()
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Initialize session on mount
  useEffect(() => {
    if (!sessionId) {
      createSession()
    }
  }, [sessionId, createSession])

  // Load extracted entities when session changes
  useEffect(() => {
    if (sessionId) {
      loadExtractedEntities()
      loadMessages()
    }
  }, [sessionId, loadExtractedEntities, loadMessages])

  return (
    <motion.div
      className="flex flex-col h-full relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.OUT }}
    >
      {/* === Header Layer === */}
      <ChatHeader onMobileMenuClick={() => setMobileInfoOpen(true)} />

      {/* === Content Layer - Left/Right Split === */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Left: AI chat area */}
        <ChatArea />

        {/* Right: Collected info sidebar - desktop only */}
        <ChatSidebar
          entities={extractedEntities}
          onConfirmEntity={confirmEntity}
        />
      </div>

      {/* === Input Layer === */}
      <UserInputPanel />

      {/* === Footer Layer === */}
      <ChatFooter />

      {/* Mobile: Collected info bottom sheet */}
      <AnimatePresence>
        {mobileInfoOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="已收集信息"
              onClick={() => setMobileInfoOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={prefersReducedMotion
                ? { duration: DURATION.FAST }
                : SPRING.SNAPPY
              }
              className="fixed right-0 left-0 bottom-0 z-50 md:hidden"
              style={{
                borderRadius: '24px 24px 0 0',
                maxHeight: '85vh',
                background: 'var(--color-surface-raised)',
                boxShadow: `0 -12px 48px color-mix(in srgb, var(--ink-100) 35%, transparent), 0 -4px 16px color-mix(in srgb, var(--ink-100) 15%, transparent)`,
              }}
            >
              {/* Drag handle - enhanced */}
              <div className="flex items-center justify-center pt-3 pb-1">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--border-strong)' }}
                />
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-b"
                style={{ borderColor: 'var(--border-default)' }}
              >
                <span className="font-medium text-sm text-primary">已收集信息</span>
                <motion.button
                  onClick={() => setMobileInfoOpen(false)}
                  className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-base transition-colors"
                  whileTap={{ scale: 0.9 }}
                  aria-label="关闭"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
              <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(85vh - 120px)' }}>
                <ChatSidebarMobile
                  entities={extractedEntities}
                  onConfirmEntity={confirmEntity}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
