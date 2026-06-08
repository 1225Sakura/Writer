import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * ParagraphIdExtension
 *
 * Adds `data-paragraph-id` attributes to each paragraph node via decorations,
 * enabling cross-panel jump-to-paragraph functionality.
 */
export const ParagraphIdPluginKey = new PluginKey('paragraphId')

export const ParagraphIdExtension = Extension.create({
  name: 'paragraphId',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: ParagraphIdPluginKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            let paragraphIndex = 0

            state.doc.descendants((node, pos) => {
              if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                const nodeEnd = pos + node.nodeSize
                decorations.push(
                  Decoration.node(pos, nodeEnd, {
                    'data-paragraph-id': String(paragraphIndex),
                  }),
                )
                paragraphIndex++
              }
              return true
            })

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
