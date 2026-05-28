import { useSettingsStore } from '@/store/settingsStore'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { SettingsNav } from './SettingsNav'
import { SettingsContent } from './SettingsContent'
import { RelationPanel } from './SettingsActions'


export function SettingEditorPage() {
  const loadAll = useSettingsStore((state) => state.loadAll)
  const undo = useSettingsStore((state) => state.undo)
  const redo = useSettingsStore((state) => state.redo)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'canvas'>('edit')

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tagName = target.tagName.toLowerCase()
      const isEditing = tagName === 'input' || tagName === 'textarea' || target.isContentEditable
      if (isEditing) return

      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((isMod && e.key === 'y') || (isMod && e.key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return (
    <motion.div
      className="flex h-full relative bg-[var(--color-surface-base)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    >
      <SettingsNav
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        mobileNavOpen={mobileNavOpen}
        onMobileNavClose={() => setMobileNavOpen(false)}
      />

      <SettingsContent
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode(viewMode === 'edit' ? 'canvas' : 'edit')}
        onMobileNavOpen={() => setMobileNavOpen(true)}
      />

      {/* Right: RelationGraph (hidden in canvas mode) */}
      {viewMode !== 'canvas' && <RelationPanel />}
    </motion.div>
  )
}
