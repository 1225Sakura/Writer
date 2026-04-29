/**
 * AnimationConfig - Unified animation system
 *
 * Centralized animation presets and variants for consistent motion design.
 * All animations use only transform and opacity for GPU acceleration.
 * Supports prefers-reduced-motion via the useReducedMotion hook.
 *
 * Design principles:
 * - Restrained use of animation, never interfering with writing
 * - Only transform and opacity (GPU-accelerated)
 * - Standardized durations and easing curves
 * - Full prefers-reduced-motion support
 */

import type { Variants, Transition } from 'framer-motion'

/** Custom spring type that includes the 'type' property */
interface SpringConfig {
  type: 'spring'
  stiffness: number
  damping: number
  mass?: number
  restSpeed?: number
}

/* ============================================================
   EASING CURVES
   ============================================================ */

export const EASE = {
  /** Primary ease-out: cubic-bezier(0.16, 1, 0.3, 1) */
  SMOOTH: [0.16, 1, 0.3, 1] as const,
  /** Secondary ease-out: cubic-bezier(0.22, 1, 0.36, 1) */
  OUT: [0.22, 1, 0.36, 1] as const,
  /** Spring-like bounce: cubic-bezier(0.34, 1.56, 0.64, 1) */
  BOUNCE: [0.34, 1.56, 0.64, 1] as const,
  /** Standard material ease: cubic-bezier(0.4, 0, 0.2, 1) */
  STANDARD: [0.4, 0, 0.2, 1] as const,
} as const

/* ============================================================
   DURATIONS (seconds)
   ============================================================ */

export const DURATION = {
  /** 150ms - Micro-interactions, hover, tap */
  FAST: 0.15,
  /** 250ms - Component state changes, standard transitions */
  NORMAL: 0.25,
  /** 400ms - Page transitions, drawer open/close */
  SLOW: 0.4,
  /** 100ms - Instant feedback */
  INSTANT: 0.1,
} as const

/* ============================================================
   SPRING CONFIGS
   ============================================================ */

export const SPRING = {
  /** Gentle spring for subtle movements */
  GENTLE: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 28,
    mass: 0.8,
  } satisfies SpringConfig,
  /** Snappy spring for responsive feedback */
  SNAPPY: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 30,
    mass: 0.7,
  } satisfies SpringConfig,
  /** Drawer spring for panel animations */
  DRAWER: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 26,
    restSpeed: 0.5,
  } satisfies SpringConfig,
  /** Immersive mode spring for toolbar/show-hide */
  IMMERSIVE: {
    type: 'spring' as const,
    stiffness: 180,
    damping: 24,
  } satisfies SpringConfig,
  /** Badge/count spring for number pop-in */
  BADGE: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 25,
  } satisfies SpringConfig,
} as const

/* ============================================================
   TRANSITION PRESETS
   ============================================================ */

export const TRANSITION = {
  /** Default fade transition */
  FADE: {
    duration: DURATION.NORMAL,
    ease: EASE.SMOOTH,
  } satisfies Transition,
  /** Fast fade for micro-interactions */
  FADE_FAST: {
    duration: DURATION.FAST,
    ease: EASE.SMOOTH,
  } satisfies Transition,
  /** Page transition with slide */
  PAGE: {
    duration: DURATION.SLOW,
    ease: EASE.OUT,
  } satisfies Transition,
  /** Drawer slide transition */
  DRAWER: {
    duration: DURATION.NORMAL,
    ease: EASE.SMOOTH,
  } satisfies Transition,
  /** Stagger children container */
  STAGGER: {
    staggerChildren: 0.06,
    delayChildren: 0.08,
  } satisfies Transition,
} as const

/* ============================================================
   VARIANT PRESETS
   ============================================================ */

/** Fade in only */
export const FADE_IN: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: TRANSITION.FADE,
  },
  exit: {
    opacity: 0,
    transition: TRANSITION.FADE_FAST,
  },
}

/** Fade in + slide up */
export const SLIDE_IN_UP: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
}

/** Fade in + slide from right */
export const SLIDE_IN_RIGHT: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
  exit: {
    opacity: 0,
    x: 16,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
}

/** Fade in + slide from left */
export const SLIDE_IN_LEFT: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
  exit: {
    opacity: 0,
    x: -16,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
}

/** Scale in (for modals, popovers) */
export const SCALE_IN: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
}

/** Page transition variants */
export const PAGE_TRANSITION: Variants = {
  enter: { opacity: 0, y: 12, scale: 0.99 },
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: DURATION.SLOW,
      ease: EASE.OUT,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.99,
    transition: {
      duration: DURATION.NORMAL,
      ease: EASE.OUT,
    },
  },
}

/** Stagger container for lists */
export const STAGGER_CONTAINER: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
}

/** Stagger item for list children */
export const STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
}

/** Drawer slide from right */
export const DRAWER_RIGHT: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
}

/** Drawer slide from left */
export const DRAWER_LEFT: Variants = {
  hidden: { x: '-100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
}

/** Drawer slide from bottom (mobile sheets) */
export const DRAWER_BOTTOM: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
}

/** Backdrop fade for overlays */
export const BACKDROP: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.FAST } },
  exit: { opacity: 0, transition: { duration: DURATION.FAST } },
}

/** Toast/notification enter */
export const TOAST: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.96,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
}

/** Reduced motion fallback - only opacity */
export const REDUCED_MOTION: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.FAST } },
  exit: { opacity: 0, transition: { duration: DURATION.INSTANT } },
}

/* ============================================================
   MICRO-INTERACTION PRESETS
   ============================================================ */

export const MICRO = {
  /** Button tap feedback */
  TAP: { scale: 0.98, transition: { duration: DURATION.INSTANT } },
  /** Button hover feedback */
  HOVER: { opacity: 0.9, transition: { duration: DURATION.INSTANT } },
  /** Card hover lift */
  CARD_HOVER: {
    y: -2,
    transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
  },
  /** Icon hover scale */
  ICON_HOVER: {
    scale: 1.05,
    transition: { duration: DURATION.INSTANT, ease: EASE.SMOOTH },
  },
} as const

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

/**
 * Create a reduced-motion-aware variant set.
 * Returns reduced motion variants when prefersReducedMotion is true.
 */
export function withReducedMotion(
  variants: Variants,
  prefersReducedMotion: boolean
): Variants {
  if (prefersReducedMotion) {
    return REDUCED_MOTION
  }
  return variants
}

/**
 * Create a spring transition with custom parameters.
 */
export function createSpring(
  stiffness: number,
  damping: number,
  mass?: number
): SpringConfig {
  return {
    type: 'spring',
    stiffness,
    damping,
    ...(mass !== undefined && { mass }),
  }
}

/**
 * Create a fade + translate variant with custom direction.
 */
export function createSlideIn(
  direction: 'up' | 'down' | 'left' | 'right',
  distance: number = 12
): Variants {
  const offset = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
  }

  return {
    hidden: { opacity: 0, ...offset[direction] },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: DURATION.NORMAL, ease: EASE.SMOOTH },
    },
    exit: {
      opacity: 0,
      ...offset[direction === 'up' ? 'down' : direction === 'down' ? 'up' : direction === 'left' ? 'right' : 'left'],
      transition: { duration: DURATION.FAST, ease: EASE.SMOOTH },
    },
  }
}

/* ============================================================
   GPU ACCELERATION HELPERS
   ============================================================ */

/** Style object for GPU-accelerated motion elements */
export const GPU_ACCELERATED = {
  willChange: 'transform, opacity' as const,
  transformOrigin: 'center center' as const,
}

/** Backface hidden for 3D transforms */
export const BACKFACE_HIDDEN = {
  backfaceVisibility: 'hidden' as const,
}
