/**
 * StaggerChildren - Re-exports from sub-components
 *
 * Split into:
 * - StaggerConfig: Types, preset definitions, variant configurations
 * - StaggerContainer: StaggerChildren component + StaggerList convenience component
 * - StaggerItem: Individual item wrapper for stagger animations
 */

export type { StaggerPreset, StaggerChildrenProps } from './StaggerConfig'
export { presetVariants } from './StaggerConfig'
export { StaggerChildren, StaggerList } from './StaggerContainer'
export { StaggerItem } from './StaggerItem'
