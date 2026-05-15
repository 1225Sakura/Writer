import { useSettingsStore } from '@/store/settingsStore'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { SettingsNav } from './SettingsNav'
import { SettingsContent } from './SettingsContent'
import { RelationPanel } from './SettingsActions'


export function SettingEditorPage() {
  const loadAll = useSettingsStore((state) => state.loadAll)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'canvas'>('edit')

  useEffect(() => {
    loadAll()
  }, [loadAll])

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
