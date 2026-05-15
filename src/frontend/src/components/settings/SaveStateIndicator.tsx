/**
 * SaveStateIndicator — Animated save state display.
 * Extracted from EntityFieldGroup.tsx.
 */

import { Loader2, AlertCircle, Check } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE, SPRING } from '@/components/shared/AnimationConfig'
import type { ValidationState } from './EntityFieldStyles'

export function SaveStateIndicator({ state, message }: { state: ValidationState; message?: string }) {
  return (
    <AnimatePresence mode="wait">
      {state === 'saving' && (
        <motion.div
          key="saving"
          className="flex items-center gap-1.5"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
        >
          <Icon icon={Loader2} size="xs" color="accent" className="animate-spin motion-reduce:animate-none" />
          <span className="text-xs" style={{ color: 'var(--accent-primary)' }}>保存中...</span>
        </motion.div>
      )}
      {state === 'saved' && (
        <motion.div
          key="saved"
          className="flex items-center gap-1.5"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={SPRING.BADGE}
          >
            <Icon icon={Check} size="xs" color="success" />
          </motion.div>
          <span className="text-xs" style={{ color: 'var(--color-success)' }}>{message || '已保存'}</span>
        </motion.div>
      )}
      {(state === 'invalid' || state === 'error') && (
        <motion.div
          key="error"
          className="flex items-center gap-1.5"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
        >
          <Icon icon={AlertCircle} size="xs" color="danger" />
          <span className="text-xs" style={{ color: 'var(--color-danger)' }}>{message || '保存失败'}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
