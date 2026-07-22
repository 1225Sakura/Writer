/**
 * MessageBubble - Chat message bubble components
 *
 * Contains ChatBubble, StreamingBubble, and their helper sub-components
 * (AIAvatar, MessageStatus, HighlightedContent, EntityChips, useTypingEffect).
 */

import { useState, useRef, useEffect } from 'react'
import type { ExtractedEntity } from '@/store'
import { Bot, Check, X } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion } from 'framer-motion'
import { EntityTag } from './EntityTag'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { typeColors } from '@/lib/entityColors'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


/* ============================================================
   TYPING EFFECT HOOK
   ============================================================ */

export function useTypingEffect(text: string, speed: number = 18, enabled: boolean = true, messageId?: string) {
  const [displayed, setDisplayed] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const indexRef = useRef(0)
  const rafRef = useRef<number>()
  const textRef = useRef(text)
  const messageIdRef = useRef(messageId)

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text)
      setIsComplete(true)
      textRef.current = text
      return
    }

    const isNewMessage = messageIdRef.current !== messageId
    const textChanged = textRef.current !== text

    if (isNewMessage || textChanged) {
      setDisplayed('')
      setIsComplete(false)
      indexRef.current = 0
      textRef.current = text
      messageIdRef.current = messageId
    }

    let lastTime = 0
    const tick = (time: number) => {
      if (time - lastTime >= speed) {
        lastTime = time
        indexRef.current += 1
        setDisplayed(textRef.current.slice(0, indexRef.current))
        if (indexRef.current >= textRef.current.length) {
          setIsComplete(true)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    if (indexRef.current < textRef.current.length) {
      rafRef.current = requestAnimationFrame(tick)
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
     
  }, [text, speed, enabled, messageId])

  return { displayed, isComplete }
}

/* ============================================================
   HIGHLIGHTED CONTENT (with entity colors)
   ============================================================ */

export function HighlightedContent({ content, entities }: { content: string; entities?: ExtractedEntity[] }) {
  // Hooks must run unconditionally — declare them first regardless of
  // whether `entities` is empty.
  const regexRef = useRef<RegExp | null>(null)
  const keyRef = useRef<string>('')

  if (!entities || entities.length === 0) {
    return <div className="text-sm whitespace-pre-wrap leading-relaxed text-primary">{content}</div>
  }

  const sortedEntities = [...entities].sort((a, b) => b.name.length - a.name.length)
  const entityNamesKey = sortedEntities.map((e) => e.name).join(',')

  if (regexRef.current === null || keyRef.current !== entityNamesKey) {
    const pattern = sortedEntities.map((e) => e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    regexRef.current = new RegExp(`(${pattern})`, 'g')
    keyRef.current = entityNamesKey
  }
  const regex = regexRef.current

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
                backgroundColor: `color-mix(in srgb, ${typeColors[entity.type]} 20%, transparent)`,
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
      <motion.div
        className="absolute inset-[-5px] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
          opacity: 0.2,
          filter: 'blur(4px)',
        }}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.3, 1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={prefersReducedMotion ? { duration: 0 } : {
          duration: isThinking ? 1.5 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div
        className="w-9 h-9 rounded-full flex items-center justify-center relative z-10
                   bg-gradient-to-br from-accent-primary/30 to-accent-primary/10 border-2 border-accent-primary/40"
        style={{
          boxShadow: isThinking
            ? '0 0 16px color-mix(in srgb, var(--accent-primary) 40%, transparent), inset 0 1px 2px color-mix(in srgb, var(--paper-100) 10%, transparent)'
            : '0 0 10px color-mix(in srgb, var(--accent-primary) 25%, transparent), inset 0 1px 2px color-mix(in srgb, var(--paper-100) 5%, transparent)',
        }}
      >
        <Icon icon={Bot} size="md" color="accent" />
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
    <div className="flex items-center gap-1.5 text-[10px] text-secondary/40">
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
          <Icon icon={Check} size="xs" color="success" />
        </motion.span>
      )}
      {status === 'error' && (
        <motion.span
          className="text-[var(--color-danger)]/80 text-[10px] flex items-center gap-0.5"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Icon icon={X} size="xs" color="danger" />
          <span>发送失败</span>
        </motion.span>
      )}
    </div>
  )
}
