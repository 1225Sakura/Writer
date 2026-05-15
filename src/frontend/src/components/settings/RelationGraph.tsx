/**
 * RelationGraph — Public API re-export.
 *
 * All implementation lives in sub-modules:
 * - GraphNode.tsx   — types, constants, data hook, node UI
 * - GraphControls.tsx — filter, zoom, search, context menu
 * - GraphLegend.tsx   — legend and stats bar
 * - GraphCanvas.tsx   — main graph rendering component
 */

export { GraphCanvas as RelationGraph } from './GraphCanvas'
export { GraphCanvas as default } from './GraphCanvas'

// Re-export types and constants for consumers that need them
export {
  ENTITY_TYPE_CONFIG,
  RELATION_TYPE_COLORS,
  RELATION_TYPE_LABELS,
  PERFORMANCE_THRESHOLD,
  useGraphData,
} from './graphTypes'

export type {
  GraphNode,
  GraphLink,
  EntityNodeType,
  NodeDetail,
  HoverTooltipState,
  ContextMenuState,
} from './graphTypes'
