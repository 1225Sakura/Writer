import { EditorContent } from '@tiptap/react'
import { useUIStore } from '@/store'
import { linkageEventBus } from '@/store/linkageStore'
import type { LinkageEventPayload } from '@/store/linkageStore'
import { motion, AnimatePresence } from 'framer-motion'
import { EditorToolbar } from './EditorToolbar'
import { WritingStatsOverlay } from './WritingStatsOverlay'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { FloatingWordCount } from './editor/FloatingWordCount'
import { EmptyStatePrompt } from './editor/EmptyStatePrompt'
import { WritingLoadingState } from './editor/WritingLoadingState'
import { ChapterTitle } from './editor/ChapterTitle'
import { StatusBar } from './editor/StatusBar'
import { WritingCanvasStatusBar } from './WritingCanvasStatusBar'
import { useWritingEditor } from './useWritingEditor'
import { InlineAIPopup } from './InlineAIPopup'
import { SelectionAIMenu } from './SelectionAIMenu'
import { StyleCheckGutter, injectStyleCheckStyles } from './StyleCheckGutter'
import { useEffect, useCallback } from 'react'

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}分${secs > 0 ? `${secs}秒` : ''}`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}时${remainingMins > 0 ? `${remainingMins}分` : ''}`
}

export function WritingCanvas() {
  const {
    editor,
    editorContainerRef,
    chapterTitle,
    wordCount,
    currentContent,
    writingStyle,
    humanAIRatio,
    loading,
    saveStatus,
    lastSavedAt,
    focusModeEnabled,
    typewriterMode,
    paperEdgeDecoration,
    sessionDuration,
    sessionWPM,
    todayWordCount,
    targetWordCount,
    isTyping,
    isLoading,
    isEmpty,
  } = useWritingEditor()

  const { paragraphFocusMode } = useUIStore()

  // Inject style check CSS on mount
  useEffect(() => {
    injectStyleCheckStyles()
  }, [])

  // Listen for entity-jump events from linkage store
  const handleEntityJump = useCallback(
    (payload: LinkageEventPayload) => {
      if (payload.type !== 'entity-jump') return
      if (!editor) return

      const { entity, paragraphIndex } = payload.data
      const editorEl = editorContainerRef.current?.querySelector('.ProseMirror')
      if (!editorEl) return

      let targetEl: HTMLElement | null = null

      // Priority 1: Direct paragraph index lookup via data-paragraph-id
      if (paragraphIndex !== undefined) {
        targetEl = editorEl.querySelector(`[data-paragraph-id="${paragraphIndex}"]`) as HTMLElement | null
      }

      // Priority 2: Search by entity name in text content (first occurrence)
      if (!targetEl && entity.name) {
        const allParagraphs = editorEl.querySelectorAll('[data-paragraph-id]')
        for (const p of allParagraphs) {
          const paragraphEl = p as HTMLElement
          if (paragraphEl.textContent?.includes(entity.name)) {
            targetEl = paragraphEl
            break
          }
        }
      }

      if (!targetEl) return

      // Scroll into view with smooth behavior
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Apply highlight animation
      targetEl.classList.add('entity-jump-highlight')
      const handleAnimEnd = () => {
        targetEl.classList.remove('entity-jump-highlight')
        targetEl.removeEventListener('animationend', handleAnimEnd)
      }
      targetEl.addEventListener('animationend', handleAnimEnd)

      // Safety timeout to remove highlight if animationend doesn't fire
      setTimeout(() => {
        targetEl.classList.remove('entity-jump-highlight')
      }, 1200)
    },
    [editor, editorContainerRef],
  )

  // Subscribe to linkage event bus
  useEffect(() => {
    const unsubscribe = linkageEventBus.on('entity-jump', handleEntityJump)
    return unsubscribe
  }, [handleEntityJump])

  return (
    <div
      ref={editorContainerRef}
      className={`h-full flex flex-col ${typewriterMode ? 'typewriter-mode' : ''} ${focusModeEnabled && paragraphFocusMode ? 'paragraph-focus-mode' : ''}`}
      style={{ backgroundColor: 'var(--writing-bg)' }}
    >
      {/* Writing area */}
      <div
        className={`flex-1 overflow-y-auto scrollbar-ink relative writing-surface writing-surface--textured selection-warm ${focusModeEnabled ? 'vignette-overlay-strong' : 'vignette-overlay'} ${typewriterMode ? 'vignette-overlay-horizontal' : ''}`}
      >
        <EditorToolbar editor={editor} />
        <SelectionAIMenu editor={editor} />

        <div
          className={`my-8 rounded-2xl max-w-[var(--writing-max-width)] mx-auto writing-card relative ink-texture
            ${paperEdgeDecoration ? 'writing-card--paper-edge' : ''}`}
          style={{
            backgroundColor: 'var(--writing-bg)',
            boxShadow: `
              0 1px 2px color-mix(in srgb, var(--ink-100) 5%, transparent),
              0 4px 12px color-mix(in srgb, var(--ink-100) 4%, transparent),
              0 12px 32px color-mix(in srgb, var(--ink-100) 3%, transparent),
              inset 0 1px 0 color-mix(in srgb, var(--paper-100) 10%, transparent)
            `,
          }}
        >
          {/* Style Check Gutter - left side indicator */}
          <StyleCheckGutter editor={editor} />
          <div
            className="absolute top-0 left-6 right-6 h-px pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--paper-100) 15%, transparent) 25%, color-mix(in srgb, var(--paper-100) 20%, transparent) 50%, color-mix(in srgb, var(--paper-100) 15%, transparent) 75%, transparent 100%)',
            }}
          />

          <div className="px-12 pt-12 pb-5">
            <ChapterTitle title={chapterTitle} />
          </div>

          <div className="min-h-full px-12 pb-16 relative">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <WritingLoadingState key="loading" />
              ) : isEmpty && !currentContent?.trim() ? (
                <EmptyStatePrompt
                  key="empty"
                  onStart={() => editor?.commands.focus('end')}
                />
              ) : (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
                >
                  <EditorContent editor={editor} id="editor-content" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <FloatingWordCount wordCount={wordCount} />

      <WritingStatsOverlay
        wordCount={wordCount}
        sessionWPM={sessionWPM}
        sessionDuration={sessionDuration}
        todayWordCount={todayWordCount}
        targetWordCount={targetWordCount}
      />

      <StatusBar
        chapterTitle={chapterTitle}
        wordCount={wordCount}
        todayWordCount={todayWordCount}
        targetWordCount={targetWordCount}
        sessionDuration={formatDuration(sessionDuration)}
        sessionWPM={sessionWPM}
        humanAIRatio={humanAIRatio}
        writingStyle={writingStyle}
        focusModeEnabled={focusModeEnabled}
        onToggleFocusMode={() => useUIStore.getState().toggleFocusMode()}
      />

      <WritingCanvasStatusBar
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        isTyping={isTyping}
        loading={loading}
      />

      <InlineAIPopup editor={editor} />
    </div>
  )
}
