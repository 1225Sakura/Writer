/**
 * useMarkdownBuffer - Buffers incomplete markdown tags during streaming
 *
 * Prevents layout breakage by holding back unclosed markdown markers
 * (bold, italic, inline code, code fences) until their closing counterparts arrive.
 */

import { useMemo } from 'react'

interface MarkdownBufferResult {
  /** Text safe to render right now */
  rendered: string
  /** Whether any content is currently buffered */
  hasBuffered: boolean
}

/**
 * Scan for the last unmatched marker position.
 * Returns the index *after* which content should be held back,
 * or -1 if everything is safe to render.
 */
function findUnsafeCutPoint(text: string): number {
  let lastUnsafe = -1

  // --- Code fences (```) --- must check first since they span multiple lines
  const fenceRegex = /^```/gm
  let fenceCount = 0
  let lastFenceIdx = -1
  let m: RegExpExecArray | null
  while ((m = fenceRegex.exec(text)) !== null) {
    fenceCount++
    lastFenceIdx = m.index
  }
  // Odd number of ``` means a code block is still open
  if (fenceCount % 2 !== 0) {
    // Hold back everything from the last opening fence onward
    lastUnsafe = Math.max(lastUnsafe, lastFenceIdx)
  }

  // --- Inline code (`) ---
  // Count backtick pairs. Ignore triple-backticks (already handled above).
  // We strip ``` first so single ` inside code fences don't confuse us.
  const stripped = text.replace(/```/g, '   ')
  const tickRegex = /`/g
  let tickCount = 0
  let lastTickIdx = -1
  while ((m = tickRegex.exec(stripped)) !== null) {
    tickCount++
    lastTickIdx = m.index
  }
  if (tickCount % 2 !== 0) {
    lastUnsafe = Math.max(lastUnsafe, lastTickIdx)
  }

  // --- Bold (**) ---
  const boldRegex = /\*\*/g
  let boldCount = 0
  let lastBoldIdx = -1
  while ((m = boldRegex.exec(text)) !== null) {
    boldCount++
    lastBoldIdx = m.index
  }
  if (boldCount % 2 !== 0) {
    lastUnsafe = Math.max(lastUnsafe, lastBoldIdx)
  }

  // --- Italic (*) --- single asterisk not part of **
  // Replace ** with placeholder, then count lone *
  const loneStar = text.replace(/\*\*/g, '  ')
  const starRegex = /\*/g
  let starCount = 0
  let lastStarIdx = -1
  while ((m = starRegex.exec(loneStar)) !== null) {
    starCount++
    lastStarIdx = m.index
  }
  if (starCount % 2 !== 0) {
    lastUnsafe = Math.max(lastUnsafe, lastStarIdx)
  }

  return lastUnsafe
}

/**
 * Hook that buffers incomplete markdown during streaming.
 *
 * @param rawText - The full raw text received so far from the stream
 * @param isStreaming - Whether streaming is still in progress
 * @returns Object with `rendered` (safe text) and `hasBuffered` flag
 */
export function useMarkdownBuffer(
  rawText: string,
  isStreaming: boolean,
): MarkdownBufferResult {
  return useMemo(() => {
    // Non-streaming: render everything immediately
    if (!isStreaming || !rawText) {
      return { rendered: rawText, hasBuffered: false }
    }

    const cutPoint = findUnsafeCutPoint(rawText)

    if (cutPoint === -1) {
      // All markers are balanced — safe to render everything
      return { rendered: rawText, hasBuffered: false }
    }

    // Only hold back content from the last unmatched marker onward
    const safe = rawText.slice(0, cutPoint)
    return { rendered: safe, hasBuffered: true }
  }, [rawText, isStreaming])
}
