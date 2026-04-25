import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface FocusModeOptions {
  enabled: boolean
  dimOpacity: number
  blurAmount: number
  focusRange: 'paragraph' | 'sentence' | 'line'
  fadeInDuration: number
  keepHeadingsVisible: boolean
  keepEmptyLinesVisible: boolean
}

export const FocusModePluginKey = new PluginKey<DecorationSet>('focusMode')

/**
 * Paragraph highlight plugin key
 * Uses Decoration mechanism to apply is-current-paragraph class
 */
export const ParagraphHighlightPluginKey = new PluginKey<{ currentParagraphPos: number | null }>('paragraphHighlight')

/**
 * Get the sentence boundaries around a position in a text node
 */
function getSentenceBoundaries(text: string, pos: number): { from: number; to: number } {
  const sentenceEnders = /[。！？.!?]/g
  let from = 0
  let to = text.length

  let match
  while ((match = sentenceEnders.exec(text)) !== null) {
    if (match.index < pos) {
      from = match.index + 1
    } else if (match.index >= pos && to === text.length) {
      to = match.index + 1
      break
    }
  }

  return { from, to }
}

/**
 * Get the line boundaries around a position (approximated by newlines)
 */
function getLineBoundaries(text: string, pos: number): { from: number; to: number } {
  const lines = text.split('\n')
  let currentPos = 0
  for (const line of lines) {
    const lineEnd = currentPos + line.length + 1
    if (currentPos <= pos && pos < lineEnd) {
      return { from: currentPos, to: lineEnd - 1 }
    }
    currentPos = lineEnd
  }
  return { from: 0, to: text.length }
}

export const FocusModeExtension = Extension.create<FocusModeOptions>({
  name: 'focusMode',

  addOptions() {
    return {
      enabled: false,
      dimOpacity: 0.22,
      blurAmount: 0.3,
      focusRange: 'paragraph',
      fadeInDuration: 500,
      keepHeadingsVisible: true,
      keepEmptyLinesVisible: false,
    }
  },

  addProseMirrorPlugins() {
    const options = this.options

    return [
      new Plugin({
        key: FocusModePluginKey,
        props: {
          decorations(state) {
            if (!options.enabled) {
              return DecorationSet.empty
            }

            const { doc, selection } = state
            const decorations: Decoration[] = []
            const selFrom = selection.from
            const selTo = selection.to

            doc.descendants((node, pos) => {
              if (node.isBlock) {
                const nodeEnd = pos + node.nodeSize

                if (options.keepHeadingsVisible && node.type.name.match(/^heading/)) {
                  return true
                }

                let isFocused = false

                if (node.isTextblock) {
                  switch (options.focusRange) {
                    case 'paragraph':
                      isFocused = nodeEnd > selFrom && pos < selTo
                      break

                    case 'sentence': {
                      if (nodeEnd > selFrom && pos < selTo) {
                        const textContent = node.textContent || ''
                        const localCursorPos = Math.max(0, selFrom - pos - 1)
                        const { from, to } = getSentenceBoundaries(textContent, localCursorPos)
                        if (from > 0) {
                          decorations.push(
                            Decoration.inline(pos + 1, pos + 1 + from, {
                              style: `opacity: ${options.dimOpacity}; transition: opacity ${options.fadeInDuration}ms ease;`,
                            })
                          )
                        }
                        if (to < textContent.length) {
                          decorations.push(
                            Decoration.inline(pos + 1 + to, nodeEnd - 1, {
                              style: `opacity: ${options.dimOpacity}; transition: opacity ${options.fadeInDuration}ms ease;`,
                            })
                          )
                        }
                        isFocused = true
                      }
                      break
                    }

                    case 'line': {
                      if (nodeEnd > selFrom && pos < selTo) {
                        const textContent = node.textContent || ''
                        const localCursorPos = Math.max(0, selFrom - pos - 1)
                        const { from, to } = getLineBoundaries(textContent, localCursorPos)
                        if (from > 0) {
                          decorations.push(
                            Decoration.inline(pos + 1, pos + 1 + from, {
                              style: `opacity: ${options.dimOpacity}; transition: opacity ${options.fadeInDuration}ms ease;`,
                            })
                          )
                        }
                        if (to < textContent.length) {
                          decorations.push(
                            Decoration.inline(pos + 1 + to, nodeEnd - 1, {
                              style: `opacity: ${options.dimOpacity}; transition: opacity ${options.fadeInDuration}ms ease;`,
                            })
                          )
                        }
                        isFocused = true
                      }
                      break
                    }
                  }
                }

                if (!isFocused) {
                  const blurStyle = options.blurAmount > 0
                    ? `opacity: ${options.dimOpacity}; filter: blur(${options.blurAmount}px); transition: opacity ${options.fadeInDuration}ms cubic-bezier(0.16, 1, 0.3, 1), filter ${options.fadeInDuration}ms cubic-bezier(0.16, 1, 0.3, 1);`
                    : `opacity: ${options.dimOpacity}; transition: opacity ${options.fadeInDuration}ms cubic-bezier(0.16, 1, 0.3, 1);`

                  decorations.push(
                    Decoration.node(pos, nodeEnd, {
                      style: blurStyle,
                      'data-focus-mode-dim': 'true',
                    })
                  )
                }
              }
              return true
            })

            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})

/**
 * Paragraph Highlight Extension
 * Uses TipTap Decoration mechanism instead of direct DOM manipulation
 */
export const ParagraphHighlightExtension = Extension.create<{ enabled: boolean }>({
  name: 'paragraphHighlight',

  addOptions() {
    return {
      enabled: false,
    }
  },

  addProseMirrorPlugins() {
    const options = this.options

    return [
      new Plugin({
        key: ParagraphHighlightPluginKey,
        state: {
          init() {
            return { currentParagraphPos: null }
          },
          apply(tr, value) {
            const meta = tr.getMeta(ParagraphHighlightPluginKey)
            if (meta !== undefined) {
              return { currentParagraphPos: meta }
            }
            if (tr.docChanged) {
              return { currentParagraphPos: null }
            }
            return value
          },
        },
        props: {
          decorations(state) {
            if (!options.enabled) {
              return DecorationSet.empty
            }

            const pluginState = ParagraphHighlightPluginKey.getState(state)
            const currentPos = pluginState?.currentParagraphPos

            if (currentPos === null || currentPos === undefined) {
              return DecorationSet.empty
            }

            const decorations: Decoration[] = []
            const doc = state.doc

            doc.descendants((node, pos) => {
              if (node.isBlock && node.isTextblock) {
                const nodeEnd = pos + node.nodeSize
                if (pos <= currentPos && currentPos < nodeEnd) {
                  decorations.push(
                    Decoration.node(pos, nodeEnd, {
                      class: 'is-current-paragraph',
                    })
                  )
                  return false
                }
              }
              return true
            })

            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})
