import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface FocusModeOptions {
  enabled: boolean
  dimOpacity: number
}

export const FocusModePluginKey = new PluginKey<DecorationSet>('focusMode')

export const FocusModeExtension = Extension.create<FocusModeOptions>({
  name: 'focusMode',

  addOptions() {
    return {
      enabled: false,
      dimOpacity: 0.4,
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
              if (node.isBlock && node.isTextblock) {
                const nodeEnd = pos + node.nodeSize
                if (nodeEnd <= selFrom || pos >= selTo) {
                  decorations.push(
                    Decoration.node(pos, nodeEnd, {
                      style: `opacity: ${options.dimOpacity}; transition: opacity 0.3s ease;`,
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
