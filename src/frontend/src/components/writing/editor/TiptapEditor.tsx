/**
 * TiptapEditor - isolated editor render shell (Phase 3 Track E.2).
 *
 * The actual editor instance is created by `useWritingEditor` in the
 * parent (which owns content, autosave, focus mode, and AI shortcuts).
 * This component is the **only** place that touches EditorContent;
 * it handles:
 *   - Loading skeleton swap
 *   - Empty-state CTA swap
 *   - Fade-in motion once content is ready
 *   - `aria-label` + `aria-multiline` ARIA attributes (already on
 *     editorProps in useWritingEditor, repeated here defensively so
 *     future re-skinning can't drop them)
 *
 * Following the Tiptap "isolate editor" pattern from
 * https://tiptap.dev/docs/editor/getting-started/install/react :
 * editor creation lives in a sibling hook (here: useWritingEditor),
 * the visual wrapper stays dumb. This file is small (≤ 100 lines)
 * on purpose so the editor boundary is easy to reason about.
 */
import { EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { EmptyStatePrompt } from './EmptyStatePrompt'
import { WritingLoadingState } from './WritingLoadingState'

interface TiptapEditorProps {
  editor: Editor | null
  currentContent: string | null | undefined
  isLoading: boolean
  isEmpty: boolean
}

export function TiptapEditor({ editor, currentContent, isLoading, isEmpty }: TiptapEditorProps) {
  if (isLoading) {
    return <WritingLoadingState key="loading" />
  }

  if (isEmpty && !currentContent?.trim()) {
    return (
      <EmptyStatePrompt
        key="empty"
        onStart={() => editor?.commands.focus('end')}
      />
    )
  }

  return (
    <motion.div
      key="editor"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      role="textbox"
      aria-multiline="true"
      aria-label="写作区"
    >
      <EditorContent editor={editor} id="editor-content" />
    </motion.div>
  )
}