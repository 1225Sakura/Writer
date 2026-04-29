/**
 * Framer Motion Animation System (Legacy)
 *
 * DEPRECATED: Use AnimationConfig.ts for all new code.
 * This file is kept for backward compatibility with existing imports.
 * Re-exports AnimationConfig values with legacy names.
 */

import { Variants, Transition } from 'framer-motion'
import {
  EASE,
  DURATION,
  SPRING,
  FADE_IN,
  SLIDE_IN_UP,
  SCALE_IN,
  STAGGER_CONTAINER,
  STAGGER_ITEM,
  DRAWER_RIGHT,
  DRAWER_LEFT,
  DRAWER_BOTTOM,
  TOAST,
} from './AnimationConfig'

/* ============================================================
   LEGACY EASING CURVES (re-exported from AnimationConfig)
   ============================================================ */

export const easings = {
  smooth: EASE.SMOOTH,
  bounce: EASE.BOUNCE,
  standard: EASE.STANDARD,
}

/* ============================================================
   LEGACY DURATIONS (re-exported from AnimationConfig)
   ============================================================ */

export const durations = {
  fast: DURATION.FAST,
  normal: DURATION.NORMAL,
  slow: DURATION.SLOW,
  page: DURATION.SLOW,
}

/* ============================================================
   LEGACY TRANSITIONS (re-exported from AnimationConfig)
   ============================================================ */

export const transitions = {
  spring: {
    type: 'spring',
    stiffness: SPRING.SNAPPY.stiffness,
    damping: SPRING.SNAPPY.damping,
    mass: SPRING.SNAPPY.mass,
  } as Transition,

  gentle: {
    type: 'spring',
    stiffness: SPRING.GENTLE.stiffness,
    damping: SPRING.GENTLE.damping,
    mass: SPRING.GENTLE.mass,
  } as Transition,

  page: {
    x: { type: 'spring', stiffness: SPRING.SNAPPY.stiffness, damping: SPRING.SNAPPY.damping, mass: SPRING.SNAPPY.mass },
    opacity: { duration: DURATION.SLOW * 0.7, ease: EASE.SMOOTH },
  } as Transition,

  fade: {
    duration: DURATION.NORMAL,
    ease: EASE.SMOOTH,
  } as Transition,

  stagger: {
    staggerChildren: 0.06,
    delayChildren: 0.08,
  } as Transition,
}

/* ============================================================
   PAGE TRANSITION VARIANTS (re-export from AnimationConfig)
   ============================================================ */

export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: {
    duration: DURATION.SLOW,
    ease: EASE.SMOOTH,
  },
}

/* ============================================================
   MICRO-INTERACTION VARIANTS
   ============================================================ */

export const buttonHover = {
  opacity: 0.85,
  transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
}

export const buttonActive = {
  scale: 0.98,
  transition: { duration: DURATION.INSTANT, ease: EASE.SMOOTH },
}

export const cardHover = {
  opacity: 0.95,
  transition: { duration: DURATION.INSTANT, ease: EASE.SMOOTH },
}

export const cardHoverLift = {
  y: -2,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
  transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
}

export const iconHover = {
  scale: 1.05,
  transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
}

export const successPulse = {
  scale: [1, 1.15, 1],
  transition: { duration: 0.4, ease: EASE.BOUNCE },
}

/* ============================================================
   LIST/STAGGER VARIANTS (re-export from AnimationConfig)
   ============================================================ */

export const staggerContainer: Variants = STAGGER_CONTAINER

export const staggerItem: Variants = STAGGER_ITEM

// Chat message stagger
export const chatMessage: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.98,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
}

/* ============================================================
   FADE ANIMATIONS (re-export from AnimationConfig)
   ============================================================ */

export const fadeIn: Variants = FADE_IN

export const fadeInUp: Variants = SLIDE_IN_UP

export const fadeInScale: Variants = SCALE_IN

/* ============================================================
   DRAWER SLIDE VARIANTS (re-export from AnimationConfig)
   ============================================================ */

export const drawerSlideRight: Variants = DRAWER_RIGHT

export const drawerSlideLeft: Variants = DRAWER_LEFT

export const drawerSlideUp: Variants = DRAWER_BOTTOM

/* ============================================================
   MODAL/DIALOG VARIANTS
   ============================================================ */

export const modalScale: Variants = SCALE_IN

/* ============================================================
   SKELETON/SHIMMER VARIANTS
   ============================================================ */

export const shimmer: Variants = {
  animate: {
    backgroundPosition: ['-200% 0', '200% 0'],
    transition: { duration: 2, repeat: Infinity, ease: 'linear' },
  },
}

export const skeletonPulse: Variants = {
  animate: {
    opacity: [0.4, 0.8, 0.4],
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },
}

export const skeletonWave: Variants = {
  animate: {
    backgroundPosition: ['-200% 0', '200% 0'],
    transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
  },
}

/* ============================================================
   SCROLL FADE VARIANTS
   ============================================================ */

export const scrollReveal: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.SLOW, ease: EASE.SMOOTH },
  },
}

export const scrollRevealScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
}

export const scrollFade: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 0 },
}

/* ============================================================
   TOAST/NOTIFICATION VARIANTS (re-export from AnimationConfig)
   ============================================================ */

export const toastEnter: Variants = TOAST

/* ============================================================
   LINK HOVER VARIANTS
   ============================================================ */

export const linkHover = {
  color: 'var(--accent-90)',
  transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
}

/* ============================================================
   LOADING SPINNER VARIANTS
   ============================================================ */

export const spinnerRotate: Variants = {
  animate: {
    rotate: 360,
    transition: { duration: 1, repeat: Infinity, ease: 'linear' },
  },
}

export const spinnerDash: Variants = {
  animate: {
    strokeDashoffset: [140, 70],
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
}

/* ============================================================
   TYPING INDICATOR VARIANTS
   ============================================================ */

export const typingDots: Variants = {
  animate: {
    opacity: [0.3, 1, 0.3],
    scale: [0.9, 1, 0.9],
    transition: { duration: 1.2, repeat: Infinity, delay: 0, ease: 'easeInOut' },
  },
}

/* ============================================================
   AMBIENT/LOOPING ANIMATIONS
   ============================================================ */

export const float: Variants = {
  animate: {
    y: [0, -4, 0],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
}

export const pulse: Variants = {
  animate: {
    scale: [1, 1.01, 1],
    opacity: [1, 0.9, 1],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
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
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
}

/* ============================================================
   ERROR/SUCCESS FEEDBACK VARIANTS
   ============================================================ */

export const shake: Variants = {
  animate: {
    x: [0, -3, 3, -3, 3, 0],
    transition: { duration: 0.35, ease: 'easeOut' },
  },
}

export const successBounce: Variants = {
  initial: { scale: 0, rotate: -20 },
  animate: {
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: SPRING.SNAPPY.stiffness,
      damping: SPRING.SNAPPY.damping,
    },
  },
}

/* ============================================================
   COMPOSED LAYOUT ANIMATIONS
   ============================================================ */

export const glassCardHover = {
  opacity: 0.95,
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  transition: { duration: DURATION.INSTANT, ease: EASE.SMOOTH },
}

/* ============================================================
   AI GENERATION ANIMATIONS
   ============================================================ */

export const cursorBlink: Variants = {
  animate: {
    opacity: [1, 0, 1],
    transition: { duration: 0.8, repeat: Infinity },
  },
}

export const generatingDots: Variants = {
  animate: (i: number) => ({
    opacity: [0.3, 0.8, 0.3],
    scale: [0.9, 1, 0.9],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      delay: i * 0.12,
      ease: 'easeInOut',
    },
  }),
}

/* ============================================================
   RE-EXPORTS FOR CONVENIENCE
   ============================================================ */

export { motion, AnimatePresence } from 'framer-motion'
export type { Variants, Transition }
