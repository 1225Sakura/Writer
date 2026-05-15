/**
 * MaterialCardVariants - Re-exports all variant renderers and sub-components
 *
 * Actual implementations are in:
 * - SpotlightCardRenderer.tsx
 * - GradientBorderCardRenderer.tsx
 * - DefaultCardRenderer.tsx
 * - CardSubComponents.tsx
 */

// Re-export variant renderers
export { SpotlightRenderer } from './SpotlightCardRenderer'
export { GradientBorderRenderer } from './GradientBorderCardRenderer'
export { DefaultCardRenderer } from './DefaultCardRenderer'

// Re-export sub-components and types
export {
  GlassCardHeader,
  GlassCardContent,
  GlassCardFooter,
  type GlassCardProps,
  type GlassCardHeaderProps,
  type GlassCardContentProps,
  type GlassCardFooterProps,
  type CardVariant,
  type CardIntensity,
  type EntityColor,
  type CardBorder,
} from './CardSubComponents'
