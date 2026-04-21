import { useEffect } from 'react'
import { useChatStore, useUIStore } from '@/store'
import { AIGuidePanel } from './AIGuidePanel'
import { UserInputPanel } from './UserInputPanel'
import { CollectedInfoPanel } from './CollectedInfoPanel'
import { Button } from '@/components/ui/Button'
import { ArrowRight, Settings, PenTool } from 'lucide-react'
import { motion } from 'framer-motion'
import { ChatSkeleton } from '@/components/shared/SmartSkeleton'

export function ChatInitPage() {
  const { extractedEntities, sessionId, createSession, loadExtractedEntities, loadMessages, confirmEntity, messages, isLoading } = useChatStore()
  const { setCurrentInterface } = useUIStore()

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

  const hasMessages = messages.length > 0

  return (
    <motion.div
      className="flex h-full bg-[#08090a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* 左侧：AI聊天区域 */}
      <div className="flex-1 flex flex-col border-r border-[rgba(255,255,255,0.08)]">
        {/* 顶部导航栏 - 毛玻璃效果 */}
        <div
          className="h-12 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between px-4 z-10 relative"
          style={{
            backgroundColor: 'rgba(15, 16, 17, 0.75)',
            backdropFilter: 'blur(12px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-primary)' }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <PenTool className="w-4 h-4 text-white" />
            </motion.div>
            <motion.h1
              className="font-medium text-sm"
              style={{ color: 'var(--text-primary)' }}
              initial={{ x: -8, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              自动化写作软件
            </motion.h1>
            {hasMessages && (
              <motion.span
                className="text-xs ml-2 px-2 py-0.5 rounded-full border"
                style={{
                  color: 'var(--text-secondary)',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.25 }}
              >
                {messages.length} 条消息
              </motion.span>
            )}
          </div>
          <motion.div
            className="flex items-center gap-2"
            initial={{ x: 8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Button
              onClick={() => setCurrentInterface('settings')}
              variant="primary"
              size="sm"
            >
              <Settings className="w-4 h-4" />
              <span>进入设定</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </motion.div>
        </div>

        {/* 聊天内容 */}
        <div className="flex-1 overflow-hidden relative">
          {isLoading && messages.length === 0 ? (
            <div className="h-full overflow-y-auto p-4">
              <ChatSkeleton count={3} />
            </div>
          ) : (
            <AIGuidePanel />
          )}
        </div>
        <UserInputPanel />
      </div>

      {/* 右侧：已收集信息面板 - 320px */}
      <motion.div
        className="w-80 overflow-y-auto"
        style={{ backgroundColor: 'var(--color-bg-surface)' }}
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <CollectedInfoPanel entities={extractedEntities} onConfirmEntity={confirmEntity} />
      </motion.div>
    </motion.div>
  )
}
