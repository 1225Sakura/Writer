/**
 * ChatToolbar — the action buttons surrounding the textarea:
 *   New chat (RefreshCw), Attach (Paperclip), Voice (Mic), Send (Send).
 *
 * Extracted from InputField.tsx (Phase 0b.2 split).
 */
import { motion } from 'framer-motion'
import { Loader2, Mic, Paperclip, RefreshCw, Send } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { speechSupported } from './ChatVoiceHook'

interface ChatToolbarProps {
  onNewChat: () => void
  onAttachClick?: () => void
  onSend: () => void
  onVoiceToggle: () => void
  isLoading: boolean
  isStreaming: boolean
  isRecording: boolean
  canSend: boolean
}

export function ChatToolbar({
  onNewChat,
  onAttachClick,
  onSend,
  onVoiceToggle,
  isLoading,
  isStreaming,
  isRecording,
  canSend,
}: ChatToolbarProps) {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <>
      {/* New chat button */}
      <motion.button
        className="min-w-11 min-h-11 flex-shrink-0 rounded-xl bg-surface-raised border border-default touch-target-min
                   flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-hover"
        title="开始新对话"
        onClick={onNewChat}
        whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        aria-label="开始新对话"
      >
        <Icon icon={RefreshCw} size="md" />
      </motion.button>

      {/* Attach button */}
      {onAttachClick && (
        <motion.button
          className="min-w-11 min-h-11 flex-shrink-0 rounded-xl bg-surface-raised border border-default touch-target-min
                     flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-hover"
          title="添加附件 (图片/文档)"
          onClick={onAttachClick}
          whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          aria-label="添加附件"
        >
          <Icon icon={Paperclip} size="md" />
        </motion.button>
      )}

      {/* Voice input button */}
      {speechSupported && (
        <motion.button
          className="min-w-11 min-h-11 flex-shrink-0 rounded-xl border touch-target-min
                     flex items-center justify-center transition-colors duration-150"
          style={{
            backgroundColor: isRecording ? 'var(--color-danger)' : 'var(--color-surface-raised)',
            borderColor: isRecording ? 'var(--color-danger)' : 'var(--border-default)',
            color: isRecording ? 'var(--paper-100)' : 'var(--text-secondary)',
          }}
          title={isRecording ? '停止录音' : '语音输入'}
          onClick={onVoiceToggle}
          aria-label={isRecording ? '停止录音' : '语音输入'}
          whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
          animate={
            isRecording && !prefersReducedMotion
              ? {
                  boxShadow: [
                    '0 0 0 0 color-mix(in srgb, var(--color-danger) 40%, transparent)',
                    '0 0 0 8px color-mix(in srgb, var(--color-danger) 0%, transparent)',
                  ],
                }
              : { boxShadow: '0 0 0 0 color-mix(in srgb, var(--color-danger) 0%, transparent)' }
          }
          transition={
            isRecording && !prefersReducedMotion
              ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
              : { duration: DURATION.FAST, ease: EASE.SMOOTH }
          }
        >
          <Icon icon={Mic} size="md" />
        </motion.button>
      )}

      {/* Send button with glow effect */}
      <motion.button
        onClick={onSend}
        disabled={!canSend}
        className="px-5 py-2.5 flex items-center gap-2 text-sm font-medium flex-shrink-0
                   rounded-xl text-primary disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-150 relative overflow-hidden touch-target-min"
        style={{
          backgroundColor: canSend ? 'var(--accent-primary)' : 'var(--color-surface-input)',
          border: canSend ? '1px solid transparent' : '1px solid var(--border-default)',
          color: canSend ? 'var(--paper-100)' : 'var(--text-secondary)',
        }}
        aria-label={isLoading || isStreaming ? '发送中' : '发送'}
        whileHover={
          canSend && !prefersReducedMotion
            ? {
                scale: 1.04,
                boxShadow:
                  '0 0 24px color-mix(in srgb, var(--accent-primary) 40%, transparent), 0 4px 12px color-mix(in srgb, var(--accent-primary) 20%, transparent)',
              }
            : {}
        }
        whileTap={canSend && !prefersReducedMotion ? { scale: 0.95 } : {}}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        {isLoading || isStreaming ? (
          <motion.div
            animate={prefersReducedMotion ? {} : { rotate: 360 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 1, repeat: Infinity, ease: 'linear' }
            }
          >
            <Icon icon={Loader2} size="sm" />
          </motion.div>
        ) : (
          <Icon icon={Send} size="sm" />
        )}
        <span>{isLoading || isStreaming ? '发送中...' : '发送'}</span>
      </motion.button>
    </>
  )
}