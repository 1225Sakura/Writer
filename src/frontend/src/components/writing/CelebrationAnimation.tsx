/**
 * CelebrationAnimation - Sprint completion celebration particles
 */

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

export function CelebrationAnimation({ onComplete }: { onComplete: () => void }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i / 12) * 360,
    color: ['var(--color-character)', 'var(--color-ifline)', 'var(--color-location)', 'var(--color-outline)', 'var(--color-vermillion)', 'var(--color-item)'][i % 6],
    distance: 40 + Math.random() * 40,
    size: 4 + Math.random() * 4,
  }))

  useEffect(() => {
    const timer = setTimeout(onComplete, 2000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0, 1, 0.5],
            x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
            y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 8px color-mix(in srgb, ${p.color} 50%, transparent)`,
          }}
        />
      ))}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
        className="relative z-10"
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-ifline) 20%, transparent) 0%, color-mix(in srgb, var(--color-success) 20%, transparent) 100%)',
            border: '1px solid color-mix(in srgb, var(--color-ifline) 30%, transparent)',
          }}
        >
          <Trophy className="w-7 h-7 text-[var(--color-success)]" />
        </div>
      </motion.div>
    </div>
  )
}
