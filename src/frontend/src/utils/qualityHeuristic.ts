/**
 * Frontend heuristic quality evaluation for AI-generated text.
 *
 * Used as a fallback when the backend quality evaluation API is unavailable.
 * Scores are based on text structure analysis: length, paragraphs, sentences,
 * vocabulary diversity, and operation-appropriate length changes.
 */

/** Count unique Chinese characters (vocabulary diversity). */
function vocabularyDiversity(text: string): number {
  const chars = text.match(/[一-鿿]/g)
  if (!chars || chars.length === 0) return 0
  return new Set(chars).size / chars.length
}

/** Score pacing based on sentence-length variance (lower variance = smoother). */
function pacingScore(text: string): number {
  const sentences = text.split(/[。！？!?]/).filter((s) => s.trim().length > 0)
  if (sentences.length < 2) return 80
  const lengths = sentences.map((s) => s.trim().length)
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length
  const variance = lengths.reduce((sum, len) => sum + (len - mean) ** 2, 0) / lengths.length
  // Normalize: lower variance = higher score
  return Math.min(100, Math.round(100 / (1 + variance / 500)))
}

/** Score based on whether length change matches the operation. */
function lengthRatioScore(original: string, result: string, operation: string): number {
  const origLen = Math.max(original.trim().length, 1)
  const resultLen = result.trim().length

  if (operation === 'expand') {
    const ratio = resultLen / origLen
    if (ratio >= 1.5) return 95
    if (ratio >= 1.2) return 85
    if (ratio >= 1.0) return 70
    return 55
  }
  if (operation === 'condense') {
    const ratio = resultLen / origLen
    if (ratio >= 0.3 && ratio <= 0.7) return 90
    if (ratio <= 0.9) return 80
    return 65
  }
  // For other operations, reasonable length is fine
  if (resultLen >= 10 && resultLen <= 5000) return 85
  return 75
}

/**
 * Compute a heuristic quality score for AI-generated text.
 *
 * Dimensions:
 * - Coherence (35%): pacing + vocabulary diversity
 * - Style consistency (30%): vocabulary diversity + pacing regularity
 * - Plot reasonability (35%): paragraph tension + length appropriateness
 *
 * Returns an integer score between 50 and 100.
 */
export function evaluateQualityHeuristic(
  original: string,
  result: string,
  operation: string
): number {
  if (!result || !result.trim()) return 50

  const pacing = pacingScore(result)
  const vocab = Math.round(vocabularyDiversity(result) * 100)
  const lengthScore = lengthRatioScore(original, result, operation)

  // Coherence: pacing + vocabulary
  const coherence = Math.round(pacing * 0.6 + vocab * 0.4)
  // Style consistency: vocabulary + pacing
  const style = Math.round(vocab * 0.5 + pacing * 0.5)
  // Plot reasonability: tension (paragraph variation) + length appropriateness
  const paragraphs = result.split(/\n\n/).filter((p) => p.trim().length > 0)
  const tension =
    paragraphs.length >= 2
      ? Math.min(
          100,
          Math.round(
            (paragraphs.reduce((sum, p) => {
              const mean = result.length / paragraphs.length
              return sum + (p.length - mean) ** 2
            }, 0) /
              paragraphs.length /
              10000) *
              100
          )
        )
      : 60
  const plot = Math.round(tension * 0.4 + lengthScore * 0.6)

  // Overall weighted average
  const overall = Math.round(coherence * 0.35 + style * 0.30 + plot * 0.35)
  return Math.max(50, Math.min(100, overall))
}
