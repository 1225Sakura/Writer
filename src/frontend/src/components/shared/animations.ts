/**
 * Framer Motion Animation System
 *
 * Centralized animation variants and configs for consistent motion design
 * across the application following the DESIGN_VISUAL.md specification.
 */

import { Variants, Transition } from 'framer-motion'

/* ============================================================
   EASING CURVES
   ============================================================ */

export const easings = {
  // Primary ease - smooth deceleration
  smooth: [0.16, 1, 0.3, 1] as const,
  // Bounce/overshoot
  bounce: [0.34, 1.56, 0.64, 1] as const,
  // Linear
  linear: [0, 0, 1, 1] as const,
  // Standard ease
  standard: [0.4, 0, 0.2, 1] as const,
}

/* ============================================================
   DURATIONS
   ============================================================ */

export const durations = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
  page: 0.35,
}

/* ============================================================
   TRANSITIONS
   ============================================================ */

export const transitions = {
  // Default spring transition
  spring: {
    type: 'spring',
    stiffness: 400,
    damping: 35,
    mass: 0.8,
  } as Transition,

  // Gentle spring for micro-interactions
  gentle: {
    type: 'spring',
    stiffness: 300,
    damping: 25,
  } as Transition,

  // Bounce spring for success states
  bouncy: {
    type: 'spring',
    stiffness: 400,
    damping: 15,
  } as Transition,

  // Page transition specific
  page: {
    x: { type: 'spring', stiffness: 400, damping: 35, mass: 0.8 },
    opacity: { duration: durations.page * 0.7, ease: easings.smooth },
    scale: { duration: durations.page * 0.7, ease: easings.smooth },
  } as Transition,

  // Fade only
  fade: {
    duration: durations.normal,
    ease: easings.smooth,
  } as Transition,

  // Stagger children
  stagger: {
    staggerChildren: 0.08,
    delayChildren: 0.1,
  } as Transition,
}

/* ============================================================
   PAGE TRANSITION VARIANTS
   ============================================================ */

export const pageTransition = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.98 },
  transition: {
    duration: durations.page,
    ease: easings.smooth,
  },
}

/* ============================================================
   MICRO-INTERACTION VARIANTS
   ============================================================ */

// Button hover/active
export const buttonHover = {
  scale: 1.02,
  transition: { duration: durations.fast, ease: easings.smooth },
}

export const buttonActive = {
  scale: 0.98,
  transition: { duration: durations.fast * 0.7, ease: easings.smooth },
}

// Card hover lift
export const cardHover = {
  y: -2,
  scale: 1.01,
  transition: { duration: 0.2, ease: easings.smooth },
}

export const cardHoverLift = {
  y: -4,
  scale: 1.02,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
  transition: { duration: 0.2, ease: easings.smooth },
}

// Icon hover
export const iconHover = {
  scale: 1.1,
  transition: { duration: durations.fast, ease: easings.bounce },
}

// Success feedback
export const successPulse = {
  scale: [1, 1.3, 1],
  transition: { duration: 0.5, ease: easings.bounce },
}

/* ============================================================
   LIST/STAGGER VARIANTS
   ============================================================ */

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: transitions.stagger,
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
}

// Chat message stagger
export const chatMessage: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: easings.smooth,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    transition: {
      duration: 0.25,
      ease: easings.smooth,
    },
  },
}

/* ============================================================
   FADE ANIMATIONS
   ============================================================ */

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: transitions.fade,
  },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
}

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
}

/* ============================================================
   DRAWER SLIDE VARIANTS
   ============================================================ */

export const drawerSlideRight: Variants = {
  hidden: { x: '100%', opacity: 0 },
  show: {
    x: 0,
    opacity: 1,
    transition: {
      duration: durations.slow,
      ease: easings.smooth,
    },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
}

export const drawerSlideLeft: Variants = {
  hidden: { x: '-100%', opacity: 0 },
  show: {
    x: 0,
    opacity: 1,
    transition: {
      duration: durations.slow,
      ease: easings.smooth,
    },
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
}

export const drawerSlideUp: Variants = {
  hidden: { y: '100%', opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      duration: durations.slow,
      ease: easings.smooth,
    },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
}

/* ============================================================
   MODAL/DIALOG VARIANTS
   ============================================================ */

export const modalScale: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: durations.normal,
      ease: easings.bounce,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: durations.fast,
      ease: easings.smooth,
    },
  },
}

/* ============================================================
   SKELETON/SHIMMER VARIANTS
   ============================================================ */

export const shimmer: Variants = {
  animate: {
    backgroundPosition: ['-200% 0', '200% 0'],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'linear',
    },
  },
}

/* ============================================================
   TYPING INDICATOR VARIANTS
   ============================================================ */

export const typingDots: Variants = {
  animate: {
    opacity: [0.2, 1, 0.2],
    scale: [0.8, 1.1, 0.8],
    y: [0, -5, 0],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      delay: 0,
      ease: 'easeInOut',
    },
  },
}

/* ============================================================
   AMBIENT/LOOPING ANIMATIONS
   ============================================================ */

export const float: Variants = {
  animate: {
    y: [0, -6, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

export const pulse: Variants = {
  animate: {
    scale: [1, 1.02, 1],
    opacity: [1, 0.85, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

export const glow: Variants = {
  animate: {
    boxShadow: [
      '0 0 4px rgba(94, 106, 210, 0.3)',
      '0 0 16px rgba(94, 106, 210, 0.6)',
      '0 0 4px rgba(94, 106, 210, 0.3)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

export const breathe: Variants = {
  animate: {
    scale: [1, 1.03, 1],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

/* ============================================================
   EXPAND/COLLAPSE VARIANTS
   ============================================================ */

export const expandCollapse: Variants = {
  hidden: { height: 0, opacity: 0 },
  show: {
    height: 'auto',
    opacity: 1,
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      duration: durations.fast,
      ease: easings.smooth,
    },
  },
}

/* ============================================================
   ERROR/SUCCESS FEEDBACK VARIANTS
   ============================================================ */

export const shake: Variants = {
  animate: {
    x: [0, -4, 4, -4, 4, 0],
    transition: { duration: 0.4, ease: 'easeOut' },
  },
}

export const successBounce: Variants = {
  initial: { scale: 0, rotate: -30 },
  animate: {
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 15,
    },
  },
}

/* ============================================================
   COMPOSED LAYOUT ANIMATIONS
   ============================================================ */

// Glass card with shimmer border
export const glassCardHover = {
  scale: 1.01,
  backgroundColor: 'rgba(255, 255, 255, 0.07)',
  borderColor: 'rgba(255, 255, 255, 0.15)',
  transition: { duration: 0.2, ease: easings.smooth },
}

// Glow card effect
export const glowCardGlow = {
  boxShadow: '0 0 20px rgba(94, 106, 210, 0.4), 0 0 40px rgba(94, 106, 210, 0.2)',
  transition: { duration: 0.3, ease: easings.smooth },
}

/* ============================================================
   AI GENERATION ANIMATIONS
   ============================================================ */

// Typewriter cursor blink
export const cursorBlink: Variants = {
  animate: {
    opacity: [1, 0, 1],
    transition: {
      duration: 0.8,
      repeat: Infinity,
    },
  },
}

// Generating dots (for AI thinking)
export const generatingDots: Variants = {
  animate: (i: number) => ({
    opacity: [0.3, 1, 0.3],
    scale: [0.8, 1, 0.8],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      delay: i * 0.15,
      ease: 'easeInOut',
    },
  }),
}

/* ============================================================
   RE-EXPORTS FOR CONVENIENCE
   ============================================================ */

export {
  motion,
  AnimatePresence,
} from 'framer-motion'

export type { Variants, Transition }
