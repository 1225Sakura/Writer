import { useEffect, useCallback } from 'react'
import { useUIStore } from '@/store'

/**
 * Centralized writing-mode keybindings.
 * Registers all Ctrl+Shift+<key> shortcuts for AI operations,
 * F11 for fullscreen, Ctrl+\ for AI drawer, Ctrl+/ for collaboration panel.
 */
export function useWritingKeybindings() {
  const {
    toggleAIDrawer,
    toggleCollaborationDrawer,
    toggleImmersiveMode,
  } = useUIStore()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey

    // Ctrl+\ -> toggle AI drawer
    if (ctrl && e.key === '\\') {
      e.preventDefault()
      toggleAIDrawer()
      return
    }

    // Ctrl+/ -> toggle collaboration panel
    if (ctrl && e.key === '/') {
      e.preventDefault()
      toggleCollaborationDrawer()
      return
    }

    // F11 -> toggle immersive mode
    if (e.key === 'F11') {
      e.preventDefault()
      toggleImmersiveMode()
      return
    }

    // Ctrl+Shift+O/E/S/R/W/P -> AI operations are handled by ShortcutListener
    // No duplication needed here; those are already wired in the shared listener.
  }, [toggleAIDrawer, toggleCollaborationDrawer, toggleImmersiveMode])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
