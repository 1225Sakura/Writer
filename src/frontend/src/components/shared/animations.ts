/**
 * Framer Motion Animation System
 *
 * Centralized animation variants and configs for consistent motion design
 * across the application following the DESIGN_VISUAL.md specification.
 *
 * 设计原则：
 * - 克制使用动画，不干扰写作
 * - 统一使用 CSS 变量（--transition-fast, --ease-out）
 * - 所有动画仅使用 transform 和 opacity
 * - 支持 prefers-reduced-motion
 */

import { Variants, Transition } from 'framer-motion'

/* ============================================================
   EASING CURVES
   统一缓动函数，与 CSS 变量同步
   ============================================================ */

export const easings = {
  // Primary ease - smooth deceleration (与 --ease-out 同步)
  smooth: [0.16, 1, 0.3, 1] as const,
  // Subtle bounce for success states
  bounce: [0.34, 1.56, 0.64, 1] as const,
  // Standard ease (与 animations.css 同步)
  standard: [0.4, 0, 0.2, 1] as const,
}

/* ============================================================
   DURATIONS
   统一时长，与 CSS 变量同步
   ============================================================ */

export const durations = {
  fast: 0.1,      // 100ms - 微交互
  normal: 0.2,    // 200ms - 组件状态
  slow: 0.25,     // 250ms - 页面过渡
  page: 0.3,      // 300ms - 页面切换
}

/* ============================================================
   TRANSITIONS
   ============================================================ */

export const transitions = {
  // Default spring transition
  spring: {
    type: 'spring',
    stiffness: 400,
    damping: 38,
    mass: 0.7,
  } as Transition,

  // Gentle spring for micro-interactions
  gentle: {
    type: 'spring',
    stiffness: 300,
    damping: 28,
  } as Transition,

  // Page transition specific
  page: {
    x: { type: 'spring', stiffness: 400, damping: 38, mass: 0.7 },
    opacity: { duration: durations.page * 0.7, ease: easings.smooth },
  } as Transition,

  // Fade only
  fade: {
    duration: durations.normal,
    ease: easings.smooth,
  } as Transition,

  // Stagger children
  stagger: {
    staggerChildren: 0.06,
    delayChildren: 0.08,
  } as Transition,
}

/* ============================================================
   PAGE TRANSITION VARIANTS
   ============================================================ */

export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: {
    duration: durations.page,
    ease: easings.smooth,
  },
}

/* ============================================================
   MICRO-INTERACTION VARIANTS
   ============================================================ */

// Button hover/active - 克制，不上浮
export const buttonHover = {
  opacity: 0.85,
  transition: { duration: durations.fast, ease: easings.smooth },
}

export const buttonActive = {
  scale: 0.98,
  transition: { duration: durations.fast * 0.7, ease: easings.smooth },
}

// Card hover - 轻微变化，不位移
export const cardHover = {
  opacity: 0.95,
  transition: { duration: 0.15, ease: easings.smooth },
}

export const cardHoverLift = {
  y: -2,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
  transition: { duration: 0.2, ease: easings.smooth },
}

// Icon hover - 轻微放大
export const iconHover = {
  scale: 1.05,
  transition: { duration: durations.fast, ease: easings.smooth },
}

// Success feedback
export const successPulse = {
  scale: [1, 1.15, 1],
  transition: { duration: 0.4, ease: easings.bounce },
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
  hidden: { opacity: 0, y: 8 },
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
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: easings.smooth,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.98,
    transition: {
      duration: 0.2,
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

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
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
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: durations.normal,
      ease: easings.smooth,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
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

// Skeleton loading variants
export const skeletonPulse: Variants = {
  animate: {
    opacity: [0.4, 0.8, 0.4],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

// Skeleton wave (more pronounced shimmer for content loading)
export const skeletonWave: Variants = {
  animate: {
    backgroundPosition: ['-200% 0', '200% 0'],
    transition: {
      duration: 1.8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

/* ============================================================
   SCROLL FADE VARIANTS
   ============================================================ */

// Scroll reveal from bottom
export const scrollReveal: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: easings.smooth,
    },
  },
}

// Scroll reveal with scale
export const scrollRevealScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: easings.smooth,
    },
  },
}

// Scroll fade (for header/toolbar hide on scroll)
export const scrollFade: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 0 },
}

/* ============================================================
   TOAST/NOTIFICATION VARIANTS
   ============================================================ */

export const toastEnter: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: easings.smooth,
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.96,
    transition: {
      duration: 0.2,
      ease: easings.smooth,
    },
  },
}

/* ============================================================
   LINK HOVER VARIANTS
   ============================================================ */

export const linkHover = {
  color: 'var(--accent-90)',
  transition: { duration: durations.fast, ease: easings.smooth },
}

/* ============================================================
   LOADING SPINNER VARIANTS
   ============================================================ */

export const spinnerRotate: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
}

export const spinnerDash: Variants = {
  animate: {
    strokeDashoffset: [140, 70],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

/* ============================================================
   TYPING INDICATOR VARIANTS
   ============================================================ */

export const typingDots: Variants = {
  animate: {
    opacity: [0.3, 1, 0.3],
    scale: [0.9, 1, 0.9],
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
   减少使用，避免干扰写作
   ============================================================ */

export const float: Variants = {
  animate: {
    y: [0, -4, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

export const pulse: Variants = {
  animate: {
    scale: [1, 1.01, 1],
    opacity: [1, 0.9, 1],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

// 移除 glow 和 breathe 动画，避免 box-shadow 动画造成的性能问题

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
      stiffness: 400,
      damping: 18,
    },
  },
}

/* ============================================================
   COMPOSED LAYOUT ANIMATIONS
   ============================================================ */

// Glass card hover - 克制
export const glassCardHover = {
  opacity: 0.95,
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  transition: { duration: 0.15, ease: easings.smooth },
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

export {
  motion,
  AnimatePresence,
} from 'framer-motion'

export type { Variants, Transition }
