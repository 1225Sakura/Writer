/**
 * Shared Components Index
 * Re-exports all shared components for convenient imports
 */

export { PageTransition } from './PageTransition'
export { ParticleBackground } from './ParticleBackground'
export { AnimatedLayout, AnimatedLayoutGroup } from './AnimatedLayout'
export { ThemeProvider } from './ThemeProvider'
export { ShortcutManager } from './ShortcutManager'
export { ErrorBoundary } from './ErrorBoundary'
export { CommandPalette } from './CommandPalette'

// Loading components
export {
  SmartSkeleton,
  ChatSkeleton,
  EntityListSkeletonPreset,
  WritingSkeleton,
  CardGridSkeleton,
} from './SmartSkeleton'
export { LoadingOverlay, SectionLoadingOverlay } from './LoadingOverlay'
export { LoadingSpinner, InlineLoading, ButtonLoading } from './LoadingSpinner'

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
