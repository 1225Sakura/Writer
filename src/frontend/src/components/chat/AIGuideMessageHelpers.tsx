/**
 * AIGuideMessageHelpers - Helper components for AIGuideBubble
 *
 * Contains useTypingEffect, HighlightedContent, EntityChips,
 * AIAvatar, and MessageStatus used by the AI guide panel bubbles.
 */

import { useState, useRef, useEffect } from 'react'
import type { ExtractedEntity } from '@/store'
import { Bot, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EntityTag } from './EntityTag'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { typeColors } from '@/lib/entityColors'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

/* ============================================================
   TYPING EFFECT HOOK
   ============================================================ */

export function useTypingEffect(text: string, speed: number = 18, enabled: boolean = true) {
  const [displayed, setDisplayed] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const indexRef = useRef(0)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text)
      setIsComplete(true)
      return
    }
    setDisplayed('')
    setIsComplete(false)
    indexRef.current = 0

    let lastTime = 0
    const tick = (time: number) => {
      if (time - lastTime >= speed) {
        lastTime = time
        indexRef.current += 1
        setDisplayed(text.slice(0, indexRef.current))
        if (indexRef.current >= text.length) {
          setIsComplete(true)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [text, speed, enabled])

  return { displayed, isComplete }
}

/* ============================================================
   HIGHLIGHTED CONTENT
   ============================================================ */

export function HighlightedContent({ content, entities }: { content: string; entities?: ExtractedEntity[] }) {
  if (!entities || entities.length === 0) {
    return <div className="text-sm whitespace-pre-wrap leading-relaxed text-primary">{content}</div>
  }

  const sortedEntities = [...entities].sort((a, b) => b.name.length - a.name.length)
  const pattern = sortedEntities.map((e) => e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = new RegExp(`(${pattern})`, 'g')
  const parts = content.split(regex)

  return (
    <div className="text-sm whitespace-pre-wrap leading-relaxed text-primary">
      {parts.map((part, i) => {
        const entity = sortedEntities.find((e) => e.name === part)
        if (entity) {
          return (
            <mark
              key={i}
              className="rounded px-0.5 py-px font-medium cursor-pointer transition-opacity hover:opacity-80"
              style={{
                backgroundColor: `${typeColors[entity.type]}33`,
                color: typeColors[entity.type],
              }}
              title={`${entity.type === 'character' ? '角色' : entity.type === 'item' ? '物品' : entity.type === 'location' ? '地点' : entity.type === 'faction' ? '势力' : entity.type} - 点击确认`}
            >
              {part}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </div>
  )
}

/* ============================================================
   ENTITY CHIPS
   ============================================================ */

export function EntityChips({ entities, onConfirm }: { entities?: ExtractedEntity[]; onConfirm?: (id: string) => void }) {
  if (!entities || entities.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {entities.map((entity, i) => (
        <motion.button
          key={entity.id}
          onClick={() => onConfirm?.(entity.id)}
          className="transition-opacity hover:opacity-80 flex items-center gap-1"
          title={entity.confirmed ? '已确认' : '点击确认'}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04, duration: DURATION.FAST, ease: EASE.STANDARD }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.95 }}
        >
          <EntityTag type={entity.type} size="small" />
          <span className="text-xs" style={{ color: typeColors[entity.type] }}>
            {entity.name}
          </span>
        </motion.button>
      ))}
    </div>
  )
}

/* ============================================================
   AI AVATAR
   ============================================================ */

export function AIAvatar({ isThinking = false }: { isThinking?: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      className="relative flex-shrink-0"
      animate={isThinking && !prefersReducedMotion ? {
        scale: [1, 1.03, 1],
      } : undefined}
      transition={prefersReducedMotion ? { duration: 0 } : isThinking ? {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      } : {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <AnimatePresence>
        {isThinking && (
          <motion.div
            className="absolute inset-0 rounded-full bg-accent-muted/30"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={prefersReducedMotion ? {} : { scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
      {!isThinking && (
        <motion.div
          className="absolute inset-0 rounded-full bg-accent-muted/20"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center relative z-10
                   bg-accent-muted border border-border-focus"
        style={{
          boxShadow: isThinking ? 'var(--shadow-glow)' : 'var(--shadow-glow-sm)',
        }}
      >
        <Bot className="w-5 h-5 text-accent-primary" />
      </div>
    </motion.div>
  )
}

/* ============================================================
   MESSAGE STATUS INDICATOR
   ============================================================ */

export function MessageStatus({ status, timestamp }: { status?: 'sending' | 'sent' | 'error'; timestamp: Date }) {
  const getRelativeTime = (date: Date) => {
    const now = Date.now()
    const diff = now - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-secondary/70">
      <span>{getRelativeTime(timestamp)}</span>
      {status === 'sending' && (
        <motion.span
          className="inline-flex items-center gap-1 text-accent-primary/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="w-1 h-1 rounded-full bg-accent-primary/60" />
          <span className="text-[10px]">发送中</span>
        </motion.span>
      )}
      {status === 'sent' && (
        <motion.span
          className="text-[var(--color-success)]/60"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        >
          <Check className="w-3 h-3" />
        </motion.span>
      )}
      {status === 'error' && (
        <motion.span
          className="text-[var(--color-danger)]/80 text-[10px] flex items-center gap-0.5"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <X className="w-3 h-3" />
          <span>发送失败</span>
        </motion.span>
      )}
    </div>
  )
}
