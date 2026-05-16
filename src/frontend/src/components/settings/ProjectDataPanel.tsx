import { useState, useEffect, useRef } from 'react'
import { useProjectDataStore } from '@/store/projectDataStore'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { Icon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE, DURATION } from '@/components/shared/AnimationConfig'
import {
  Camera, RotateCcw, Trash2, Download, Upload,
  RefreshCw, FileJson, FileText, FileBox, AlertCircle, CheckCircle2, Loader2,
} from 'lucide-react'

type Tab = 'snapshots' | 'export' | 'import'

export function ProjectDataPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('snapshots')
  const [snapshotName, setSnapshotName] = useState('')
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          管理项目快照、备份和数据导入导出
        </p>
      </div>

      {/* Error display */}
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

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-surface-overlay)]">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200
              ${activeTab === key
                ? 'bg-[var(--color-surface-base)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}
            `}
          >
            <Icon icon={icon} size="xs" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'snapshots' && (
          <motion.div
            key="snapshots"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            className="space-y-4"
          >
            {/* Create snapshot */}
            <GlassCard intensity="light" border="subtle" rounded="lg" padding="md">
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">创建快照</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="快照名称（可选）"
                  className="flex-1 px-3 py-2 rounded-md bg-[var(--color-surface-overlay)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                />
                <Button
                  onClick={async () => {
                    await createSnapshot(snapshotName || undefined)
                    setSnapshotName('')
                  }}
                  disabled={loading}
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                >
                  {loading ? <Icon icon={Loader2} size="xs" className="animate-spin" /> : <Icon icon={Camera} size="xs" />}
                  创建
                </Button>
              </div>
            </GlassCard>

            {/* Backup status */}
            {backupStatus && (
              <GlassCard intensity="light" border="subtle" rounded="lg" padding="md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">自动备份</h3>
                  <Button onClick={triggerBackup} disabled={loading} variant="ghost" size="sm" className="gap-1">
                    <Icon icon={RefreshCw} size="xs" />
                    立即备份
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                  <div>状态: <span className="font-medium text-[var(--text-primary)]">{backupStatus.status}</span></div>
                  <div>间隔: <span className="font-medium">{backupStatus.schedule.interval_minutes}分钟</span></div>
                  {backupStatus.last_backup && (
                    <div>上次备份: <span className="font-medium">{new Date(backupStatus.last_backup).toLocaleString()}</span></div>
                  )}
                  <div>最大快照数: <span className="font-medium">{backupStatus.schedule.max_snapshots}</span></div>
                </div>
              </GlassCard>
            )}

            {/* Snapshot list */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                快照列表 ({snapshots.length})
              </h3>
              {snapshots.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">暂无快照</p>
              ) : (
                <div className="space-y-2">
                  {snapshots.map((snap) => (
                    <GlassCard key={snap.id} intensity="light" border="subtle" rounded="lg" padding="sm">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {snap.name || snap.id}
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {new Date(snap.created_at).toLocaleString()}
                            {snap.size_bytes != null && ` · ${(snap.size_bytes / 1024).toFixed(1)} KB`}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            onClick={async () => {
                              if (confirm('确定要恢复此快照？当前数据将被覆盖。')) {
                                await restoreSnapshot(snap.id)
                              }
                            }}
                            disabled={loading}
                            variant="ghost"
                            size="sm"
                            title="恢复"
                          >
                            <Icon icon={RotateCcw} size="xs" />
                          </Button>
                          <Button
                            onClick={async () => {
                              if (confirm('确定要删除此快照？')) {
                                await deleteSnapshot(snap.id)
                              }
                            }}
                            disabled={loading}
                            variant="ghost"
                            size="sm"
                            title="删除"
                          >
                            <Icon icon={Trash2} size="xs" />
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'export' && (
          <motion.div
            key="export"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            className="space-y-3"
          >
            <h3 className="text-sm font-medium text-[var(--text-primary)]">导出项目数据</h3>
            <div className="grid gap-3">
              <ExportButton
                icon={FileJson}
                label="导出为 JSON"
                description="标准JSON格式，适合程序导入"
                onClick={exportJSON}
                loading={loading}
              />
              <ExportButton
                icon={FileText}
                label="导出为 YAML"
                description="YAML格式，人类可读"
                onClick={exportYAML}
                loading={loading}
              />
              <ExportButton
                icon={FileBox}
                label="导出为 ZIP"
                description="ZIP压缩包，包含所有资源"
                onClick={() => exportZIP('json')}
                loading={loading}
              />
            </div>
          </motion.div>
        )}

        {activeTab === 'import' && (
          <motion.div
            key="import"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            className="space-y-4"
          >
            <h3 className="text-sm font-medium text-[var(--text-primary)]">导入项目数据</h3>

            {/* Import mode selector */}
            <div className="flex gap-2">
              {(['merge', 'replace'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setImportMode(mode)}
                  className={`
                    flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 border
                    ${importMode === mode
                      ? 'bg-[var(--accent-muted)] border-[var(--accent-200)] text-[var(--text-primary)]'
                      : 'bg-transparent border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}
                  `}
                >
                  {mode === 'merge' ? '合并模式' : '替换模式'}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">
              {importMode === 'merge'
                ? '合并模式：将导入数据与现有数据合并'
                : '替换模式：用导入数据完全替换现有数据'}
            </p>

            {/* Import buttons */}
            <div className="grid gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml,.zip"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    if (file.name.endsWith('.json')) {
                      const text = await file.text()
                      const data = JSON.parse(text)
                      await importJSON(data, importMode)
                    } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
                      const text = await file.text()
                      await importYAML(text, importMode)
                    } else if (file.name.endsWith('.zip')) {
                      await importZIP(file, importMode)
                    }
                  } catch {
                    // Error is handled by the store
                  }
                  e.target.value = ''
                }}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                variant="default"
                className="gap-2 justify-start"
              >
                <Icon icon={Upload} size="sm" />
                选择文件导入 (JSON / YAML / ZIP)
              </Button>
            </div>

            {/* Import result */}
            <AnimatePresence>
              {importResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <GlassCard intensity="light" border="subtle" rounded="lg" padding="md">
                    <div className="flex items-start gap-2">
                      <Icon icon={importResult.success ? CheckCircle2 : AlertCircle} size="sm"
                        className={importResult.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {importResult.success ? '导入成功' : '导入失败'}
                        </p>
                        {importResult.summary && (
                          <pre className="text-xs text-[var(--text-tertiary)] mt-1 whitespace-pre-wrap">
                            {JSON.stringify(importResult.summary, null, 2)}
                          </pre>
                        )}
                      </div>
                      <button onClick={clearImportResult} className="text-xs underline opacity-70 hover:opacity-100 text-[var(--text-tertiary)]">关闭</button>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ExportButton({ icon, label, description, onClick, loading }: {
  icon: typeof FileJson
  label: string
  description: string
  onClick: () => void
  loading: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-surface-base)] hover:bg-[var(--color-surface-overlay)] transition-all duration-200 text-left group"
    >
      <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-overlay)] flex items-center justify-center group-hover:bg-[var(--accent-muted)] transition-colors">
        <Icon icon={icon} size="sm" color="accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
      </div>
      {loading && <Icon icon={Loader2} size="xs" className="animate-spin text-[var(--text-tertiary)]" />}
    </button>
  )
}
