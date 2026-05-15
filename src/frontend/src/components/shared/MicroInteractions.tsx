/**
 * MicroInteractions - 微交互反馈组件
 *
 * 提供按钮点击反馈、悬停效果、状态变化等微动效
 * 设计原则：克制、有意义、不干扰写作
 *
 * 设计规范：
 * - Hover: 微妙颜色变化，不位移
 * - Active/Press: scale(0.98), 100ms
 * - Error: 红色抖动 (shake)
 * - 支持 prefers-reduced-motion
 *
 * Sub-modules:
 * - MicroInteractionsVariants: Shared variants, hooks, re-exports
 * - MicroInteractionsButtons: RippleEffect, ButtonFeedback, PressFeedback,
 *     StaggerListEntrance, CardHoverGlow, InputFocusGlow
 * - MicroInteractionsControls: IconButton, Toggle, HoverCard, PulseIndicator
 * - MicroInteractionsEffects: ShimmerButton, MagneticEffect, CountUpNumber,
 *     ShakeFeedback
 */

// Re-export everything from sub-modules
export {
  easeOutSmooth,
  easeSpring,
  microVariants,
  useReducedMotion,
} from './MicroInteractionsVariants'

export {
  RippleEffect,
  ButtonFeedback,
  PressFeedback,
  StaggerListEntrance,
  CardHoverGlow,
  InputFocusGlow,
} from './MicroInteractionsButtons'

export {
  IconButton,
  Toggle,
  HoverCard,
  PulseIndicator,
} from './MicroInteractionsControls'

export {
  ShimmerButton,
  MagneticEffect,
  CountUpNumber,
  ShakeFeedback,
} from './MicroInteractionsEffects'
