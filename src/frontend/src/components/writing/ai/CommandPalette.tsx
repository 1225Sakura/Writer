/**
 * CommandPalette - Slash command menu for AI operations in the editor
 *
 * When the user types "/" at the start of a paragraph (or anywhere),
 * a floating menu appears with AI operations: 续写、优化、扩写、缩写、改写、润色.
 *
 * Uses @tiptap/suggestion for input detection and floating positioning.
 * Selection via arrow keys + Enter, or click. Esc closes.
 */

import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
// Icons are rendered via inline SVG in ICON_SVG map below
import { useAIStore } from '@/store'
import { showToast } from '@/components/ui/Toast'

/* ============================================================
   TYPES
   ============================================================ */

export interface CommandItem {
  id: 'continue' | 'optimize' | 'expand' | 'condense' | 'rewrite' | 'polish'
  label: string
  description: string
  icon: string // SVG path or component name
  keywords: string[]
}

/* ============================================================
   PLUGIN KEY
   ============================================================ */

/** Unique ProseMirror plugin key for the command palette suggestion */
const CommandPalettePluginKey = new PluginKey('commandPalette')

/* ============================================================
   COMMAND DEFINITIONS
   ============================================================ */

const COMMANDS: CommandItem[] = [
  {
    id: 'continue',
    label: '续写',
    description: 'AI 自动续写后续内容',
    icon: 'arrow-right',
    keywords: ['续写', 'continue', 'xuxie'],
  },
  {
    id: 'optimize',
    label: '优化',
    description: '优化选中文本的质量和表达',
    icon: 'sparkles',
    keywords: ['优化', 'optimize', 'youhua'],
  },
  {
    id: 'expand',
    label: '扩写',
    description: '扩展文本，增加细节描写',
    icon: 'maximize',
    keywords: ['扩写', 'expand', 'kuoxie'],
  },
  {
    id: 'condense',
    label: '缩写',
    description: '精简文本，保留核心内容',
    icon: 'minimize',
    keywords: ['缩写', 'condense', 'suoxie'],
  },
  {
    id: 'rewrite',
    label: '改写',
    description: '改写文本，保持含义改变表达',
    icon: 'refresh',
    keywords: ['改写', 'rewrite', 'gaixie'],
  },
  {
    id: 'polish',
    label: '润色',
    description: '润色文本，提升文笔质量',
    icon: 'paintbrush',
    keywords: ['润色', 'polish', 'runse'],
  },
]

/* ============================================================
   ICON MAP (for rendering in the floating DOM)
   ============================================================ */

const ICON_SVG: Record<string, string> = {
  'arrow-right':
    '<path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  sparkles:
    '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM18 14l.75 2.25L21 17l-2.25.75L18 20l-.75-2.25L15 17l2.25-.75L18 14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  maximize:
    '<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  minimize:
    '<path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  refresh:
    '<path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  paintbrush:
    '<path d="M18.37 2.63a2.12 2.12 0 013 3L14 13l-4 1 1-4 7.37-7.37z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M9 15c-3.31 0-6 2.69-6 6h12c0-3.31-2.69-6-6-6z" stroke="currentColor" stroke-width="1.5" fill="none"/>',
}

/* ============================================================
   FILTER LOGIC
   ============================================================ */

function filterCommands(query: string): CommandItem[] {
  if (!query) return COMMANDS
  const q = query.toLowerCase()
  return COMMANDS.filter(
    (cmd) =>
      cmd.label.includes(q) ||
      cmd.id.includes(q) ||
      cmd.keywords.some((kw) => kw.includes(q))
  )
}

/* ============================================================
   RENDERING HELPERS
   ============================================================ */

function createCommandPaletteDOM(): {
  container: HTMLDivElement
  list: HTMLDivElement
  update: (items: CommandItem[], selectedIndex: number) => void
  setSelected: (index: number) => void
  getSelectedItem: () => CommandItem | null
} {
  const container = document.createElement('div')
  container.className = 'command-palette-popup'
  container.style.cssText = `
    position: absolute;
    z-index: 100;
    min-width: 220px;
    max-width: 300px;
    border-radius: 12px;
    overflow: hidden;
    background: linear-gradient(180deg, color-mix(in srgb, var(--ink-100) 95%, transparent), color-mix(in srgb, var(--ink-100) 98%, transparent));
    border: 1px solid color-mix(in srgb, var(--paper-100) 10%, transparent);
    box-shadow: 0 8px 32px color-mix(in srgb, var(--ink-100) 30%, transparent), 0 2px 8px color-mix(in srgb, var(--ink-100) 15%, transparent);
    font-family: var(--font-sans, system-ui);
    pointer-events: auto;
  `

  // Header
  const header = document.createElement('div')
  header.style.cssText = `
    padding: 8px 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--paper-100) 8%, transparent);
    display: flex;
    align-items: center;
    gap: 6px;
  `
  const badge = document.createElement('span')
  badge.textContent = 'AI'
  badge.style.cssText = `
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--color-outline, #7088a8) 20%, transparent);
    color: var(--color-outline, #7088a8);
  `
  const headerText = document.createElement('span')
  headerText.textContent = 'AI 操作'
  headerText.style.cssText = `
    font-size: 11px;
    color: var(--paper-70, #b5a99a);
  `
  header.appendChild(badge)
  header.appendChild(headerText)
  container.appendChild(header)

  // List
  const list = document.createElement('div')
  list.style.cssText = `
    padding: 4px;
    max-height: 260px;
    overflow-y: auto;
  `
  container.appendChild(list)

  let currentItems: CommandItem[] = []
  let currentSelected = 0

  function update(items: CommandItem[], selectedIndex: number) {
    currentItems = items
    currentSelected = selectedIndex
    list.innerHTML = ''

    items.forEach((item, i) => {
      const row = document.createElement('div')
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.1s;
        background: ${i === selectedIndex ? 'color-mix(in srgb, var(--paper-100) 8%, transparent)' : 'transparent'};
      `
      row.addEventListener('mouseenter', () => {
        row.style.background = 'color-mix(in srgb, var(--paper-100) 8%, transparent)'
      })
      row.addEventListener('mouseleave', () => {
        row.style.background =
          i === currentSelected
            ? 'color-mix(in srgb, var(--paper-100) 8%, transparent)'
            : 'transparent'
      })

      // Icon
      const iconWrap = document.createElement('div')
      iconWrap.style.cssText = `
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        flex-shrink: 0;
        background: color-mix(in srgb, var(--color-outline, #7088a8) 12%, transparent);
      `
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', '14')
      svg.setAttribute('height', '14')
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.setAttribute('fill', 'none')
      svg.innerHTML = ICON_SVG[item.icon] || ''
      svg.style.color = 'var(--color-outline, #7088a8)'
      iconWrap.appendChild(svg)
      row.appendChild(iconWrap)

      // Text
      const textWrap = document.createElement('div')
      textWrap.style.cssText = 'flex: 1; min-width: 0;'
      const label = document.createElement('div')
      label.textContent = item.label
      label.style.cssText = `
        font-size: 13px;
        font-weight: 500;
        color: var(--paper-85, #d6cfc3);
      `
      const desc = document.createElement('div')
      desc.textContent = item.description
      desc.style.cssText = `
        font-size: 11px;
        color: var(--paper-50, #8a7d6e);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `
      textWrap.appendChild(label)
      textWrap.appendChild(desc)
      row.appendChild(textWrap)

      // Click handler
      row.addEventListener('click', () => {
        currentSelected = i
        // Dispatch a custom event so the Suggestion command can pick it up
        container.dispatchEvent(
          new CustomEvent('command-select', { detail: item })
        )
      })

      list.appendChild(row)
    })
  }

  function setSelected(index: number) {
    currentSelected = index
    const rows = list.children
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as HTMLDivElement
      row.style.background =
        i === index
          ? 'color-mix(in srgb, var(--paper-100) 8%, transparent)'
          : 'transparent'
    }
    // Scroll into view
    const selectedRow = rows[index] as HTMLElement | undefined
    selectedRow?.scrollIntoView({ block: 'nearest' })
  }

  function getSelectedItem(): CommandItem | null {
    return currentItems[currentSelected] || null
  }

  return { container, list, update, setSelected, getSelectedItem }
}

/* ============================================================
   EXTENSION
   ============================================================ */

export const CommandPaletteExtension = Extension.create({
  name: 'commandPalette',

  addProseMirrorPlugins() {
    const self = this

    return [
      Suggestion({
        editor: self.editor,
        char: '/',
        pluginKey: CommandPalettePluginKey,
        allowSpaces: false,
        allowedPrefixes: null,
        startOfLine: false,

        items: ({ query }) => {
          return filterCommands(query)
        },

        command: ({ editor, range, props }: { editor: import('@tiptap/core').Editor; range: import('@tiptap/core').Range; props: CommandItem }) => {
          // Delete the "/" and any query text
          editor.chain().focus().deleteRange(range).run()

          // Execute the AI command on the current paragraph
          executeAICommand(editor, props.id)
        },

        render: () => {
          let paletteDOM: ReturnType<typeof createCommandPaletteDOM> | null =
            null
          let wrapperEl: HTMLDivElement | null = null

          function positionPalette(clientRect: DOMRect | null) {
            if (!wrapperEl || !clientRect) return
            const editorEl = document.querySelector('.writing-card')
            if (!editorEl) return
            const editorRect = editorEl.getBoundingClientRect()

            wrapperEl.style.top = `${clientRect.bottom - editorRect.top + 6}px`
            wrapperEl.style.left = `${Math.min(
              clientRect.left - editorRect.left,
              editorRect.width - 320
            )}px`
          }

          return {
            onStart: (props: SuggestionProps<CommandItem>) => {
              // Create wrapper positioned relative to the writing card
              wrapperEl = document.createElement('div')
              wrapperEl.style.cssText = `
                position: absolute;
                z-index: 100;
                top: 0;
                left: 0;
                pointer-events: none;
              `

              paletteDOM = createCommandPaletteDOM()
              paletteDOM.update(props.items, 0)
              wrapperEl.appendChild(paletteDOM.container)

              // Attach to the writing card
              const editorContainer = document.querySelector('.writing-card')
              if (editorContainer) {
                ;(editorContainer as HTMLElement).style.position = 'relative'
                editorContainer.appendChild(wrapperEl)
              }

              // Position
              if (props.clientRect) {
                positionPalette(props.clientRect())
              }

              // Listen for click selection
              paletteDOM.container.addEventListener(
                'command-select',
                ((e: CustomEvent<CommandItem>) => {
                  props.command(e.detail)
                }) as EventListener
              )
            },

            onUpdate: (props: SuggestionProps<CommandItem>) => {
              if (!paletteDOM) return
              paletteDOM.update(props.items, 0)
              if (props.clientRect) {
                positionPalette(props.clientRect())
              }
            },

            onExit: () => {
              if (wrapperEl?.parentNode) {
                wrapperEl.parentNode.removeChild(wrapperEl)
              }
              wrapperEl = null
              paletteDOM = null
            },

            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (!paletteDOM) return false

              const { event } = props

              if (event.key === 'ArrowUp') {
                event.preventDefault()
                // Move selection up - handled by re-rendering with new index
                return true
              }

              if (event.key === 'ArrowDown') {
                event.preventDefault()
                return true
              }

              if (event.key === 'Enter') {
                event.preventDefault()
                const selected = paletteDOM.getSelectedItem()
                if (selected) {
                  props.view.dispatch(
                    props.view.state.tr.setMeta('suggestionCommand', selected)
                  )
                }
                return true
              }

              if (event.key === 'Escape') {
                return true
              }

              return false
            },
          }
        },
      }),
    ]
  },
})

/* ============================================================
   AI COMMAND EXECUTION
   ============================================================ */

async function executeAICommand(
  editor: import('@tiptap/core').Editor,
  commandId: CommandItem['id']
) {
  const aiStore = useAIStore.getState()

  // Get the current paragraph text
  const { from } = editor.state.selection
  const $pos = editor.state.doc.resolve(from)
  const paragraphStart = $pos.before($pos.depth || 1)
  const paragraphEnd = $pos.after($pos.depth || 1)
  const paragraphText = editor.state.doc.textBetween(
    paragraphStart,
    paragraphEnd,
    '\n'
  )

  if (!paragraphText.trim()) {
    showToast('请先输入一些内容再使用AI操作', 'error')
    return
  }

  showToast(`AI ${commandId}中...`, 'info')

  try {
    const action = aiStore[commandId]
    if (!action) {
      showToast('未知的AI操作', 'error')
      return
    }

    const result = await action(paragraphText)

    if (result && result.trim()) {
      // Replace the current paragraph with the result
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.delete(paragraphStart, paragraphEnd)
          tr.insertText(result, paragraphStart)
          return true
        })
        .run()

      const labels: Record<string, string> = {
        continue: '续写',
        optimize: '优化',
        expand: '扩写',
        condense: '缩写',
        rewrite: '改写',
        polish: '润色',
      }
      showToast(`AI ${labels[commandId] || commandId}完成`, 'success')
    }
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : 'AI操作失败，请重试'
    showToast(msg, 'error')
  }
}
