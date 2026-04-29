/**
 * Shared Components Index
 * Re-exports all shared components for convenient imports
 */

export { PageTransition } from './PageTransition'
export {
  AnimatedLayout,
  AnimatedLayoutGroup,
  AnimatedContainer,
  AnimatedFade,
  AnimatedScale,
} from './AnimatedLayout'
export { ThemeProvider, useThemeContext } from './ThemeProvider'
export { ShortcutManager } from './ShortcutManager'
export { ErrorBoundary } from './ErrorBoundary'
export { CommandPalette } from './CommandPalette'

// Enhanced components (newer versions with more features)
export {
  RippleEffect,
  ButtonFeedback,
  PressFeedback,
  StaggerListEntrance,
  CardHoverGlow,
  InputFocusGlow,
  IconButton,
  Toggle,
  HoverCard,
  PulseIndicator,
  ShimmerButton,
  MagneticEffect,
  CountUpNumber,
  ShakeFeedback,
  microVariants,
  easeOutSmooth,
  easeSpring,
  useReducedMotion,
} from './MicroInteractions'

export {
  EnhancedPageTransition,
  PageIndicator,
  usePageTransition,
  type TransitionVariant,
  type TransitionDirection,
} from './EnhancedPageTransition'

// Note: TransitionOverlay is not exported by EnhancedPageTransition

// Scroll & reveal animations
export {
  ScrollReveal,
  ScrollRevealGroup,
  ScrollRevealStagger,
  type RevealAnimation,
} from './ScrollReveal'

// Stagger animations
export {
  StaggerChildren,
  StaggerItem,
  StaggerList,
  type StaggerPreset,
} from './StaggerChildren'

// Animated text
export {
  AnimatedText,
  AnimatedHeading,
  Typewriter,
  RevealText,
  HighlightText,
  type TextAnimationType,
} from './AnimatedText'

// Loading overlay variants
export {
  LoadingOverlayVariant,
  InlineLoadingVariant,
  BrandLoadingScreen,
  SkeletonOverlay,
  type LoadingVariant,
} from './LoadingOverlayVariants'

// Glass morphism - unified in ui/GlassCard, re-exported here for convenience
export {
  GlassCard,
  GlassCardHeader,
  GlassCardContent,
  GlassCardFooter,
  // Legacy compatibility aliases
  GlowCard,
  PremiumCard,
  SpotlightCard,
  type GlassCardProps,
  type CardVariant,
  type CardIntensity,
  type EntityColor,
  type CardBorder,
  type GlowIntensity,
  type SpotlightColor,
} from '@/components/ui/GlassCard'

// Gradient borders
export {
  GradientBorder,
  AnimatedGradientBorder,
  GlowBorder,
  type GradientPreset,
  type GradientDirection,
} from './GradientBorder'

// Loading components
export {
  SmartSkeleton,
  ChatSkeleton,
  EntityListSkeletonPreset,
  WritingSkeleton,
  CardGridSkeleton,
  SkeletonTransition,
  ContentFadeIn,
} from './SmartSkeleton'
export {
  LoadingOverlay,
  SectionLoadingOverlay,
  InlineSectionLoading,
  type OverlayVariant,
} from './LoadingOverlay'
export {
  LoadingSpinner,
  InlineLoading,
  ButtonLoading,
  PageLoading,
  SkeletonLoading,
  type SpinnerVariant,
  type SpinnerSize,
} from './LoadingSpinner'

// Legacy skeleton (deprecated, use SmartSkeleton instead)
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonChat,
  SkeletonList,
  SkeletonGraph,
} from './Skeleton'

// Unified background system (replaces all legacy background components)
export {
  UnifiedBackground,
  getBackgroundModeForInterface,
  getBackgroundDensity,
  getBackgroundSpeed,
} from './UnifiedBackground'
export type {
  UnifiedBackgroundMode,
} from './UnifiedBackground'

// Keyboard shortcut display
export {
  Kbd,
  KbdCombo,
  KbdShortcut,
  KbdHelp,
} from './Kbd'
export type {
  KbdProps,
  KbdSize,
  KbdVariant,
} from './Kbd'
