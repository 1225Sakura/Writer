/**
 * CorkboardView virtualized layout constants.
 *
 * v0.5 Phase 3 Track E.5: extracted from CorkboardView to satisfy
 * the 300-line per-file budget (AC-1).
 */
export const CARD_MIN_WIDTH = 220
export const CARD_HEIGHT = 180
export const GRID_GAP = 12
export const OVERSCAN_ROWS = 10

/**
 * Compute how many card columns fit in a given container width.
 * Mirrors the CSS auto-fill at minmax(CARD_MIN_WIDTH, 1fr) trick.
 */
export function computeColumnCount(containerWidth: number): number {
  const innerWidth = Math.max(0, containerWidth - 32) // p-4 (16px each side)
  if (innerWidth <= 0) return 1
  return Math.max(1, Math.floor((innerWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)))
}
