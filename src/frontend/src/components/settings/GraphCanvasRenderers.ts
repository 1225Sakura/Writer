/**
 * GraphCanvasRenderers — Canvas 2D rendering functions for nodes and links.
 * Pure functions with explicit state parameters (no closure dependencies).
 * Extracted from GraphNode.tsx.
 */

import { ENTITY_TYPE_CONFIG } from './graphTypes'
import type { EntityNodeType } from './graphTypes'

// ============================================
// Canvas color resolver — reads CSS variables on theme change
// ============================================

let canvasColors: Record<string, string> = {}

export function updateCanvasColors() {
  const style = getComputedStyle(document.documentElement)
  canvasColors = {
    accent: style.getPropertyValue('--accent-100').trim() || '#c9a96e',
    accent80: style.getPropertyValue('--accent-80').trim() || '#8b7355',
    ink100: style.getPropertyValue('--ink-100').trim() || '#1a1510',
    ink90: style.getPropertyValue('--ink-90').trim() || '#2a1f14',
    ink85: style.getPropertyValue('--ink-85').trim() || '#332820',
    ink80: style.getPropertyValue('--ink-80').trim() || '#3d3028',
    ink70: style.getPropertyValue('--ink-70').trim() || '#554538',
    paper100: style.getPropertyValue('--paper-100').trim() || '#f5eed6',
    paper90: style.getPropertyValue('--paper-90').trim() || '#e8dcc4',
    paper85: style.getPropertyValue('--paper-85').trim() || '#ddd0b5',
    paper70: style.getPropertyValue('--paper-70').trim() || '#9c8c70',
    vermillion: style.getPropertyValue('--vermillion-100').trim() || '#8b3a3a',
    location: style.getPropertyValue('--color-location').trim() || '#6b9e8e',
    borderDefault: style.getPropertyValue('--border-default').trim() || 'rgba(201, 169, 110, 0.12)',
    // Entity type colors for Canvas resolution
    colorCharacter: style.getPropertyValue('--color-character').trim() || '#c9a06e',
    colorItem: style.getPropertyValue('--color-item').trim() || '#8b7aaa',
    colorLocation: style.getPropertyValue('--color-location').trim() || '#6b9e8e',
    colorFaction: style.getPropertyValue('--color-faction').trim() || '#a04848',
    colorWorld: style.getPropertyValue('--color-world').trim() || '#7088a8',
    colorRule: style.getPropertyValue('--color-rule').trim() || '#7088a8',
    colorOutline: style.getPropertyValue('--color-outline').trim() || '#7088a8',
    colorIfline: style.getPropertyValue('--color-ifline').trim() || '#7a9e58',
  }
}

/** Helper to add alpha to a hex color */
function hexAlpha(hex: string, alpha: number): string {
  hex = hex.replace('#', '')
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Resolve a CSS var() expression to its computed hex value */
function resolveCssVar(cssVar: string): string {
  const match = cssVar.match(/var\((--[^)]+)\)/)
  if (!match) return cssVar
  const style = getComputedStyle(document.documentElement)
  return style.getPropertyValue(match[1]).trim() || cssVar
}

/** Resolve an ENTITY_TYPE_CONFIG color (may be CSS var) to a concrete hex for Canvas */
function resolveEntityColor(configColor: string | undefined, type: EntityNodeType): string {
  if (!configColor) return canvasColors.accent
  // Map entity type to resolved color
  const typeColorMap: Record<EntityNodeType, string> = {
    character: canvasColors.colorCharacter,
    item: canvasColors.colorItem,
    location: canvasColors.colorLocation,
    faction: canvasColors.colorFaction,
    world: canvasColors.colorWorld,
    rule: canvasColors.colorRule,
    outline: canvasColors.colorOutline,
    ifline: canvasColors.colorIfline,
  }
  return typeColorMap[type] || canvasColors.accent
}

// Initialize on load
updateCanvasColors()

// ============================================
// Canvas Renderer: nodeCanvasObject
// ============================================

export function renderNodeCanvas(
  node: any,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  state: {
    hoveredNodeId: string | null
    selectedNodeId: string | null
    activeHighlightId: string | null
    renderMode: string
    animationPulse: number
    animationOrbit: number
  },
) {
  const nodeType = node.type as EntityNodeType
  const config = ENTITY_TYPE_CONFIG[nodeType]
  const entityColor = resolveEntityColor(config?.color, nodeType)
  const isHovered = node.id === state.hoveredNodeId
  const isSelected = state.selectedNodeId === node.id || state.activeHighlightId === node.id
  const baseSize = config?.size || 6
  const baseRadius = Math.sqrt(node.val) * baseSize + baseSize
  const radius = baseRadius * (isHovered ? 1.3 : 1)
  const x = node.x as number
  const y = node.y as number
  const pulseScale = isHovered ? 1 + Math.sin(state.animationPulse / 200) * 0.08 : 1
  const finalRadius = radius * pulseScale

  if (isHovered || isSelected) {
    for (let i = 5; i > 0; i--) {
      const glowRadius = finalRadius + i * 10
      const glowGradient = ctx.createRadialGradient(x, y, finalRadius, x, y, glowRadius)
      glowGradient.addColorStop(0, hexAlpha(entityColor, 0.5))
      glowGradient.addColorStop(0.4, hexAlpha(entityColor, 0.2))
      glowGradient.addColorStop(1, 'transparent')
      ctx.fillStyle = glowGradient
      ctx.beginPath()
      ctx.arc(x, y, glowRadius, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  if (isHovered && state.renderMode === 'full') {
    const ringRadius = finalRadius + 14
    ctx.beginPath()
    ctx.arc(x, y, ringRadius, state.animationOrbit, state.animationOrbit + Math.PI * 1.5)
    ctx.strokeStyle = hexAlpha(entityColor, 0.2)
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (state.renderMode === 'full') {
    const innerGlowRadius = finalRadius + 4
    const innerGlow = ctx.createRadialGradient(x, y, finalRadius, x, y, innerGlowRadius)
    innerGlow.addColorStop(0, hexAlpha(entityColor, 0.19))
    innerGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = innerGlow
    ctx.beginPath()
    ctx.arc(x, y, innerGlowRadius, 0, 2 * Math.PI)
    ctx.fill()
  }

  ctx.shadowColor = isHovered ? entityColor : 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = isHovered ? 25 : 8
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = isHovered ? 0 : 4

  const nodeGradient = ctx.createRadialGradient(x - finalRadius * 0.35, y - finalRadius * 0.35, 0, x, y, finalRadius)
  nodeGradient.addColorStop(0, canvasColors.ink80)
  nodeGradient.addColorStop(0.5, canvasColors.ink90)
  nodeGradient.addColorStop(1, canvasColors.ink100)

  ctx.beginPath()
  ctx.arc(x, y, finalRadius, 0, 2 * Math.PI)
  ctx.fillStyle = nodeGradient
  ctx.fill()

  const strokeRingRadius = finalRadius + 1.5
  ctx.beginPath()
  ctx.arc(x, y, strokeRingRadius, 0, 2 * Math.PI)
  ctx.strokeStyle = isHovered
    ? hexAlpha(entityColor, 0.8)
    : isSelected
      ? hexAlpha(entityColor, 0.6)
      : hexAlpha(entityColor, 0.33)
  ctx.lineWidth = isHovered ? 2.5 : isSelected ? 2 : 1.5
  ctx.stroke()

  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  const highlightGradient = ctx.createRadialGradient(x - finalRadius * 0.3, y - finalRadius * 0.3, 0, x, y, finalRadius * 0.7)
  highlightGradient.addColorStop(0, hexAlpha(canvasColors.accent, 0.15))
  highlightGradient.addColorStop(0.5, hexAlpha(canvasColors.accent, 0.04))
  highlightGradient.addColorStop(1, 'transparent')
  ctx.beginPath()
  ctx.arc(x, y, finalRadius * 0.7, 0, 2 * Math.PI)
  ctx.fillStyle = highlightGradient
  ctx.fill()

  const borderWidth = isHovered ? 2.5 : isSelected ? 2 : 0
  if (borderWidth > 0) {
    ctx.beginPath()
    ctx.arc(x, y, finalRadius + 4, 0, 2 * Math.PI)
    ctx.strokeStyle = isHovered ? hexAlpha(canvasColors.accent, 0.7) : hexAlpha(canvasColors.accent, 0.5)
    ctx.lineWidth = borderWidth
    ctx.stroke()
  }

  if (node.val > 3) {
    ctx.beginPath()
    ctx.arc(x, y, finalRadius + 7, 0, 2 * Math.PI)
    ctx.strokeStyle = hexAlpha(canvasColors.accent, 0.2)
    ctx.lineWidth = 1
    ctx.setLineDash([6, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }

  const label = node.name
  const fontSize = Math.max(11 / globalScale, 9)
  ctx.font = `${isHovered ? '600' : '500'} ${fontSize}px "Source Han Sans", "Noto Sans SC", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const yOffset = finalRadius + fontSize * 1.2
  const displayLabel = label.length > 8 ? label.slice(0, 8) + '..' : label
  const textMetrics = ctx.measureText(displayLabel)
  const textWidth = textMetrics.width
  const padding = 5

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.beginPath()
  ctx.roundRect(x - textWidth / 2 - padding, y + yOffset - fontSize / 2 - padding / 2 + 1, textWidth + padding * 2, fontSize + padding, 4)
  ctx.fill()

  ctx.fillStyle = hexAlpha(canvasColors.ink100, 0.88)
  ctx.beginPath()
  ctx.roundRect(x - textWidth / 2 - padding, y + yOffset - fontSize / 2 - padding / 2, textWidth + padding * 2, fontSize + padding, 4)
  ctx.fill()

  ctx.fillStyle = isHovered ? canvasColors.paper100 : hexAlpha(canvasColors.paper100, 0.78)
  ctx.fillText(displayLabel, x, y + yOffset)

  if (isHovered) {
    const dotX = x - textWidth / 2 - 10
    const dotY = y + yOffset
    ctx.beginPath()
    ctx.arc(dotX, dotY, 4, 0, 2 * Math.PI)
    ctx.fillStyle = entityColor
    ctx.shadowColor = entityColor
    ctx.shadowBlur = 8
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

// ============================================
// Canvas Renderer: linkCanvasObject
// ============================================

export function renderLinkCanvas(
  link: any,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  state: {
    hoveredNodeId: string | null
    activeHighlightId: string | null
    renderMode: string
    animationFlow: number
    animationParticle: number
  },
) {
  const focusId = state.hoveredNodeId || state.activeHighlightId
  const isHighlighted = focusId && (link.source.id === focusId || link.target.id === focusId)
  const isDimmed = focusId && !isHighlighted
  if (isDimmed && state.renderMode === 'simple') return

  const start = link.source
  const end = link.target
  const sx = start.x as number
  const sy = start.y as number
  const ex = end.x as number
  const ey = end.y as number

  const midX = (sx + ex) / 2
  const midY = (sy + ey) / 2
  const dx = ex - sx
  const dy = ey - sy
  const dist = Math.sqrt(dx * dx + dy * dy)
  const curvature = Math.min(dist * 0.15, 35)
  const perpX = (-dy / dist) * curvature
  const perpY = (dx / dist) * curvature
  const cx = midX + perpX
  const cy = midY + perpY

  const opacity = isDimmed ? 0.05 : isHighlighted ? 1 : 0.45
  const lineWidth = isHighlighted ? 3 : isDimmed ? 0.5 : 1.5
  // Resolve link color — may be a CSS var from RELATION_TYPE_COLORS
  const rawColor = link.color || canvasColors.accent
  const color = rawColor.startsWith('var(')
    ? resolveCssVar(rawColor)
    : rawColor

  const parseColor = (c: string, a: number) => {
    if (c.startsWith('#')) {
      return hexAlpha(c, a)
    }
    return c
  }

  const gradient = ctx.createLinearGradient(sx, sy, ex, ey)
  gradient.addColorStop(0, parseColor(color, opacity * 0.2))
  gradient.addColorStop(0.3, parseColor(color, opacity * 0.7))
  gradient.addColorStop(0.7, parseColor(color, opacity))
  gradient.addColorStop(1, parseColor(color, opacity * 0.2))

  ctx.strokeStyle = gradient
  ctx.globalAlpha = 1
  ctx.lineWidth = lineWidth / globalScale
  ctx.lineCap = 'round'

  if (isHighlighted) {
    ctx.shadowColor = color
    ctx.shadowBlur = 8
  }

  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.quadraticCurveTo(cx, cy, ex, ey)
  ctx.stroke()
  ctx.shadowBlur = 0

  if (state.renderMode === 'full') {
    const dashLength = 6
    const gapLength = isHighlighted ? 3 : 8
    const flowOffset = (state.animationFlow * 10) % (dashLength + gapLength)
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.quadraticCurveTo(cx, cy, ex, ey)
    ctx.strokeStyle = parseColor(color, isHighlighted ? opacity * 0.5 : opacity * 0.18)
    ctx.lineWidth = (isHighlighted ? 1.5 : 0.8) / globalScale
    ctx.setLineDash([dashLength, gapLength])
    ctx.lineDashOffset = -flowOffset
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (isHighlighted && state.renderMode === 'full') {
    const particleCount = 3
    for (let i = 0; i < particleCount; i++) {
      const t = (state.animationParticle * 0.5 + i / particleCount) % 1
      const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex
      const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey
      const particleSize = 3 - t * 2
      ctx.beginPath()
      ctx.arc(px, py, particleSize, 0, 2 * Math.PI)
      ctx.fillStyle = parseColor(color, (1 - t) * 0.8)
      ctx.shadowColor = color
      ctx.shadowBlur = 6
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  if (isHighlighted && state.renderMode !== 'simple') {
    const angle = Math.atan2(ey - cy, ex - cx)
    const arrowSize = 6 / globalScale
    const arrowX = ex - Math.cos(angle) * (curvature * 0.3 + 5)
    const arrowY = ey - Math.sin(angle) * (curvature * 0.3 + 5)
    ctx.beginPath()
    ctx.moveTo(arrowX, arrowY)
    ctx.lineTo(arrowX - arrowSize * Math.cos(angle - Math.PI / 6), arrowY - arrowSize * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(arrowX - arrowSize * Math.cos(angle + Math.PI / 6), arrowY - arrowSize * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fillStyle = parseColor(color, opacity * 0.8)
    ctx.fill()
  }
}
