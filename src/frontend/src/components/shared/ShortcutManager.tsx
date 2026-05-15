/**
 * ShortcutManager - Re-exports from sub-components
 *
 * Split into:
 * - ShortcutRegistry: AI operation execution logic
 * - ShortcutListener: useGlobalShortcuts hook (keyboard event handling)
 * - ShortcutDisplay: ShortcutManager component + help text
 */

export { executeAIOperation } from './ShortcutRegistry'
export { useGlobalShortcuts } from './ShortcutListener'
export { ShortcutManager, getShortcutsHelpText } from './ShortcutDisplay'
