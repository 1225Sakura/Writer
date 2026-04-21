import * as React from 'react'
import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface MagneticButtonProps {
  strength?: number
  children: React.ReactNode
  className?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  title?: string
  'aria-label'?: string
}

export const MagneticButton = React.forwardRef<HTMLButtonElement, MagneticButtonProps>(
  ({ className, strength = 0.3, children, ...props }, ref) => {
    const buttonRef = useRef<HTMLButtonElement>(null)

    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const springConfig = { damping: 15, stiffness: 150 }
    const springX = useSpring(x, springConfig)
    const springY = useSpring(y, springConfig)

    const rotateX = useTransform(springY, [-20, 20], [5, -5])
    const rotateY = useTransform(springX, [-20, 20], [-5, 5])

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const button = buttonRef.current
      if (!button) return

      const rect = button.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const distanceX = e.clientX - centerX
      const distanceY = e.clientY - centerY

      x.set(distanceX * strength)
      y.set(distanceY * strength)
    }

    const handleMouseLeave = () => {
      x.set(0)
      y.set(0)
    }

    return (
      <motion.div
        className="inline-block"
        style={{ x: springX, y: springY, rotateX, rotateY, perspective: 500 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <button
          ref={(node: HTMLButtonElement | null) => {
            (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
          }}
          className={twMerge(
            clsx(
              'inline-flex items-center justify-center font-medium transition-colors duration-200 cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e6ad2] focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50'
            ),
            className
          )}
          {...props}
        >
          {children}
        </button>
      </motion.div>
    )
  }
)

MagneticButton.displayName = 'MagneticButton'
