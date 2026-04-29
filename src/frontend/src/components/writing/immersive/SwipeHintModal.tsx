import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ArrowRight } from 'lucide-react'
import { useSwipeHandler } from '@/hooks/useSwipeHandler'
import { DURATION, EASE, SPRING } from '@/components/shared/AnimationConfig'


interface SwipeHintModalProps {
  onOpenOutline: () => void
  onOpenAIOperation: () => void
}

export function SwipeHintModal({ onOpenOutline, onOpenAIOperation }: SwipeHintModalProps) {
  const { showSwipeHint, dismissSwipeHint } = useSwipeHandler({
    enabled: true,
    onSwipeLeft: onOpenAIOperation,
    onSwipeRight: onOpenOutline,
  })

  return (
    <AnimatePresence>
      {showSwipeHint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
          className="fixed inset-0 z-50 flex items-center justify-center md:hidden"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={dismissSwipeHint}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              dismissSwipeHint()
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="手势操作提示"
          tabIndex={0}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={SPRING.SNAPPY}
            className="mx-6 p-5 rounded-2xl max-w-xs w-full"
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
              }
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-primary">手势操作提示</span>
              <button
                onClick={dismissSwipeHint}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    dismissSwipeHint()
                  }
                }}
                className="p-2 rounded-lg hover:bg-surface-base transition-colors touch-target-min focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                aria-label="关闭手势提示"
              >
                <X className="w-4 h-4 text-secondary" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-base flex items-center justify-center">
                  <motion.div
                    animate={{ x: [0, 8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <ArrowLeft className="w-5 h-5 text-accent-primary" />
                  </motion.div>
                </div>
                <div>
                  <div className="text-sm text-primary">从左向右滑</div>
                  <div className="text-xs text-secondary">打开大纲侧边栏</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-base flex items-center justify-center">
                  <motion.div
                    animate={{ x: [0, -8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                  >
                    <ArrowRight className="w-5 h-5 text-accent-primary" />
                  </motion.div>
                </div>
                <div>
                  <div className="text-sm text-primary">从右向左滑</div>
                  <div className="text-xs text-secondary">打开 AI 操作面板</div>
                </div>
              </div>
            </div>
            <button
              onClick={dismissSwipeHint}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  dismissSwipeHint()
                }
              }}
              className="w-full mt-4 py-2.5 text-xs rounded-lg bg-accent-primary text-white hover:bg-accent-hover transition-colors touch-target-min btn-active-scale focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              知道了
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
