/**
 * Shared Components Index
 * Re-exports all shared components for convenient imports
 */

export { PageTransition } from './PageTransition'
export { ParticleBackground } from './ParticleBackground'
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
  GlowCard,
  GlowBadge,
  GlowDivider,
  type GlowIntensity,
  type GlowColor,
} from './GlowCard'

export {
  RippleEffect,
  ButtonFeedback,
  IconButton,
  Toggle,
  HoverCard,
  PulseIndicator,
  ShimmerButton,
  MagneticEffect,
  CountUpNumber,
} from './MicroInteractions'

export {
  EnhancedParticleBackground,
} from './EnhancedParticleBackground'

// Note: FloatingParticle is not exported by EnhancedParticleBackground

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
  type RevealAnimation,
} from './ScrollReveal'

// Stagger animations
export {
  StaggerChildren,
  StaggerItem,
  StaggerList,
  type StaggerPreset,
} from './StaggerChildren'

// Loading overlay variants
export {
  LoadingOverlayVariant,
  InlineLoadingVariant,
  BrandLoadingScreen,
  SkeletonOverlay,
  type LoadingVariant,
} from './LoadingOverlayVariants'

// Glass morphism (enhanced with more variants)
export {
  GlassCard,
  GlassPanel,
  GlassBadge,
  GlassButton,
  GlassDivider,
  type GlassIntensity,
  type GlassBorder,
  type GlassVariant,
} from './GlassCard'

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
