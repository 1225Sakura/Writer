/**
 * GlassCard - Backward-compatible re-export from MaterialCard
 *
 * This file exists so that existing imports from '@/components/ui/GlassCard'
 * continue to work. All implementation lives in MaterialCard.tsx.
 */

export {
  MaterialCard,
  GlassCard,
  GlassCardHeader,
  GlassCardContent,
  GlassCardFooter,
  GlowCard,
  PremiumCard,
  SpotlightCard,
  type GlassCardProps,
  type GlowCardProps,
  type PremiumCardProps,
  type SpotlightCardProps,
  type CardVariant,
  type CardIntensity,
  type EntityColor,
  type CardBorder,
  type GlowIntensity,
  type SpotlightColor,
  type GlassCardHeaderProps,
  type GlassCardContentProps,
  type GlassCardFooterProps,
} from './MaterialCard'
