import { useState, useEffect } from 'react'
import { useProjectDataStore } from '@/store/projectDataStore'
import { Icon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Download, Upload, AlertCircle } from 'lucide-react'
import { SnapshotTab, ExportTab, ImportTab } from './ProjectDataPanelSections'

type Tab = 'snapshots' | 'export' | 'import'

export function ProjectDataPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('snapshots')
  const [snapshotName, setSnapshotName] = useState('')
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')

  const {
    snapshots, backupStatus, importResult, loading, error,
    listSnapshots, createSnapshot, restoreSnapshot, deleteSnapshot,
    triggerBackup, getBackupStatus, exportJSON, exportYAML, exportZIP,
    importJSON, importYAML, importZIP, clearError, clearImportResult,
  } = useProjectDataStore()

  useEffect(() => {
    listSnapshots()
    getBackupStatus()
  }, [listSnapshots, getBackupStatus])

  const tabs: Array<{ key: Tab; label: string; icon: typeof Camera }> = [
    { key: 'snapshots', label: '快照', icon: Camera },
    { key: 'export', label: '导出', icon: Download },
    { key: 'import', label: '导入', icon: Upload },
  ]

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">项目数据</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">管理项目快照、备份和数据导入导出</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-error)]/30 text-sm text-[var(--color-error)]"
          >
            <Icon icon={AlertCircle} size="sm" />
            <span className="flex-1">{error}</span>
            <button onClick={clearError} className="text-xs underline opacity-70 hover:opacity-100">关闭</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-surface-overlay)]">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === key
                ? 'bg-[var(--color-surface-base)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Icon icon={icon} size="xs" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'snapshots' && (
          <SnapshotTab
            snapshots={snapshots}
            backupStatus={backupStatus}
            snapshotName={snapshotName}
            setSnapshotName={setSnapshotName}
            loading={loading}
            createSnapshot={createSnapshot}
            restoreSnapshot={restoreSnapshot}
            deleteSnapshot={deleteSnapshot}
            triggerBackup={triggerBackup}
          />
        )}
        {activeTab === 'export' && (
          <ExportTab loading={loading} exportJSON={exportJSON} exportYAML={exportYAML} exportZIP={exportZIP} />
        )}
        {activeTab === 'import' && (
          <ImportTab
            importMode={importMode}
            setImportMode={setImportMode}
            loading={loading}
            importResult={importResult}
            importJSON={importJSON}
            importYAML={importYAML}
            importZIP={importZIP}
            clearImportResult={clearImportResult}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
