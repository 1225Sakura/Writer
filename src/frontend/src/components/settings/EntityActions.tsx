/**
 * EntityActions — Re-exported entity cards and animation variants.
 * CharacterCard, NewCharacterForm, EditableEntityCard → CharacterActions.tsx
 * ChapterSummaryModal → ChapterSummaryModal.tsx
 * OutlineEditor → OutlineEditor.tsx
 */

// Re-export from sub-modules
export { CharacterCard, NewCharacterForm, EditableEntityCard } from './CharacterActions'
export { OutlineEditor } from './OutlineEditor'

// ============================================
// Animation Variants
// ============================================

export const entityListVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
}

export const entityItemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.15 },
  },
}
