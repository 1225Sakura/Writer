import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

interface AmbientOrbProps {
  className?: string
}

const ENTITY_COLORS = {
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
  item: 'var(--color-item)',
  character: 'var(--color-character)',
  faction: 'var(--color-faction)',
} as const

type EntityColor = keyof typeof ENTITY_COLORS

interface OrbConfig {
  size: string
  position: { top?: string; bottom?: string; left?: string; right?: string }
  color: EntityColor
  blur: string
  animationDuration: number
  animationDelay?: number
  reverse?: boolean
}

const ORB_CONFIGS: OrbConfig[] = [
  {
    size: '28rem',
    position: { top: '-12%', right: '-8%' },
    color: 'character',
    blur: '70px',
    animationDuration: 18,
  },
  {
    size: '22rem',
    position: { bottom: '-10%', left: '-5%' },
    color: 'outline',
    blur: '80px',
    animationDuration: 22,
    reverse: true,
  },
  {
    size: '20rem',
    position: { top: '45%', left: '50%' },
    color: 'accent',
    blur: '90px',
    animationDuration: 20,
    animationDelay: -6,
  },
  {
    size: '14rem',
    position: { top: '10%', left: '-3%' },
    color: 'ifline',
    blur: '60px',
    animationDuration: 15,
    animationDelay: -3,
  },
  {
    size: '12rem',
    position: { bottom: '8%', right: '-2%' },
    color: 'item',
    blur: '60px',
    animationDuration: 17,
    animationDelay: -8,
    reverse: true,
  },
]

export function AmbientOrb({ className }: AmbientOrbProps) {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      key="ambient-glow"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 2.0, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-0 pointer-events-none z-25 ${className || ''}`}
      aria-hidden="true"
    >
      {ORB_CONFIGS.map((orb, index) => {
        const colorValue = ENTITY_COLORS[orb.color]
        const animationProps = prefersReducedMotion
          ? {}
          : {
              animate: {
                scale: [1, 1.06, 0.98, 1.04, 1],
                opacity: [0.75, 1, 0.65, 0.9, 0.75],
              },
              transition: {
                duration: orb.animationDuration,
                repeat: Infinity,
                ease: 'easeInOut',
                times: [0, 0.25, 0.5, 0.75, 1],
                delay: orb.animationDelay,
              },
            }

        return (
          <div
            key={index}
            className="absolute rounded-full"
            style={{
              width: orb.size,
              height: orb.size,
              top: orb.position.top,
              bottom: orb.position.bottom,
              left: orb.position.left,
              right: orb.position.right,
              transform:
                orb.position.top === '45%' && orb.position.left === '50%'
                  ? 'translate(-50%, -50%)'
                  : undefined,
              background: `radial-gradient(circle, color-mix(in srgb, ${colorValue} 5%, transparent) 0%, color-mix(in srgb, ${colorValue} 1.5%, transparent) 35%, transparent 70%)`,
              filter: `blur(${orb.blur})`,
              animation: prefersReducedMotion
                ? undefined
                : `ambient-orb-float ${orb.animationDuration}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite${orb.reverse ? ' reverse' : ''}${orb.animationDelay ? ` ${orb.animationDelay}s` : ''}`,
            }}
          >
            {!prefersReducedMotion && (
              <motion.div
                className="w-full h-full"
                {...animationProps}
              />
            )}
          </div>
        )
      })}
    </motion.div>
  )
}
