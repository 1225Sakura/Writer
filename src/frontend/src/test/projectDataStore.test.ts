import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useProjectDataStore,
  selectSnapshots,
  selectSnapshotCount,
  selectBackupStatus,
  selectExportData,
  selectImportResult,
  selectProjectDataLoading,
  selectProjectDataError,
  cleanupProjectDataStore,
} from '@/store/projectDataStore'

// Mock API modules
vi.mock('@/api/snapshots', () => ({
  snapshotsApi: {
    createSnapshot: vi.fn().mockResolvedValue({ id: 'snap-1', name: 'test', created_at: '2026-01-01' }),
    listSnapshots: vi.fn().mockResolvedValue([]),
    restoreSnapshot: vi.fn().mockResolvedValue({ success: true }),
    deleteSnapshot: vi.fn().mockResolvedValue({}),
    triggerBackup: vi.fn().mockResolvedValue({}),
    getBackupStatus: vi.fn().mockResolvedValue({ last_backup: null, status: 'idle' }),
  },
}))

vi.mock('@/api/exportImport', () => ({
  exportImportApi: {
    exportProject: vi.fn().mockResolvedValue({ version: '1.0', characters: [], items: [] }),
    exportAsYaml: vi.fn().mockResolvedValue({}),
    exportAsZip: vi.fn().mockResolvedValue({}),
    importProject: vi.fn().mockResolvedValue({ imported: { characters: 0 } }),
    importFromYaml: vi.fn().mockResolvedValue({ imported: { characters: 0 } }),
    importFromZip: vi.fn().mockResolvedValue({ imported: { characters: 0 } }),
  },
}))

vi.mock('@/store/utils/indexedDBStorage', () => ({
  createHybridStorage: () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('projectDataStore', () => {
  beforeEach(() => {
    useProjectDataStore.setState({
      snapshots: [],
      currentSnapshot: null,
      backupStatus: null,
      exportData: null,
      importResult: null,
      loading: false,
      error: null,
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useProjectDataStore())
    expect(result.current.snapshots).toEqual([])
    expect(result.current.currentSnapshot).toBeNull()
    expect(result.current.backupStatus).toBeNull()
    expect(result.current.exportData).toBeNull()
    expect(result.current.importResult).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should expose all actions', () => {
    const { result } = renderHook(() => useProjectDataStore())
    expect(typeof result.current.createSnapshot).toBe('function')
    expect(typeof result.current.listSnapshots).toBe('function')
    expect(typeof result.current.restoreSnapshot).toBe('function')
    expect(typeof result.current.deleteSnapshot).toBe('function')
    expect(typeof result.current.triggerBackup).toBe('function')
    expect(typeof result.current.getBackupStatus).toBe('function')
    expect(typeof result.current.exportJSON).toBe('function')
    expect(typeof result.current.exportYAML).toBe('function')
    expect(typeof result.current.exportZIP).toBe('function')
    expect(typeof result.current.importJSON).toBe('function')
    expect(typeof result.current.importYAML).toBe('function')
    expect(typeof result.current.importZIP).toBe('function')
    expect(typeof result.current.clearError).toBe('function')
    expect(typeof result.current.clearImportResult).toBe('function')
    expect(typeof result.current.clearExportData).toBe('function')
  })

  it('should create a snapshot', async () => {
    const { snapshotsApi } = await import('@/api/snapshots')
    vi.mocked(snapshotsApi.createSnapshot).mockResolvedValueOnce({
      id: 'snap-42',
      name: 'Before edit',
      created_at: '2026-01-01T00:00:00Z',
    } as any)
    vi.mocked(snapshotsApi.listSnapshots).mockResolvedValueOnce([
      { id: 'snap-42', name: 'Before edit', created_at: '2026-01-01' },
    ] as any)

    const { result } = renderHook(() => useProjectDataStore())
    let snap: any
    await act(async () => {
      snap = await result.current.createSnapshot('Before edit', 'Pre-edit backup')
    })
    expect(snap.id).toBe('snap-42')
    expect(result.current.currentSnapshot).toBeDefined()
    expect(result.current.loading).toBe(false)
  })

  it('should handle createSnapshot error', async () => {
    const { snapshotsApi } = await import('@/api/snapshots')
    vi.mocked(snapshotsApi.createSnapshot).mockRejectedValueOnce(new Error('Disk full'))

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      try {
        await result.current.createSnapshot('test')
      } catch {
        // expected
      }
    })
    expect(result.current.error).toBe('Disk full')
    expect(result.current.loading).toBe(false)
  })

  it('should list snapshots', async () => {
    const { snapshotsApi } = await import('@/api/snapshots')
    vi.mocked(snapshotsApi.listSnapshots).mockResolvedValueOnce([
      { id: 's1', name: 'Snap 1', created_at: '2026-01-01' },
      { id: 's2', name: 'Snap 2', created_at: '2026-01-02' },
    ] as any)

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      await result.current.listSnapshots()
    })
    expect(result.current.snapshots).toHaveLength(2)
    expect(result.current.loading).toBe(false)
  })

  it('should handle listSnapshots error', async () => {
    const { snapshotsApi } = await import('@/api/snapshots')
    vi.mocked(snapshotsApi.listSnapshots).mockRejectedValueOnce(new Error('Connection refused'))

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      await result.current.listSnapshots()
    })
    expect(result.current.error).toBe('Connection refused')
    expect(result.current.loading).toBe(false)
  })

  it('should restore a snapshot', async () => {
    const { snapshotsApi } = await import('@/api/snapshots')
    vi.mocked(snapshotsApi.restoreSnapshot).mockResolvedValueOnce({ success: true } as any)

    const { result } = renderHook(() => useProjectDataStore())
    let restoreResult: any
    await act(async () => {
      restoreResult = await result.current.restoreSnapshot('snap-1')
    })
    expect(restoreResult.success).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  it('should handle restoreSnapshot error', async () => {
    const { snapshotsApi } = await import('@/api/snapshots')
    vi.mocked(snapshotsApi.restoreSnapshot).mockRejectedValueOnce(new Error('Snapshot corrupted'))

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      try {
        await result.current.restoreSnapshot('bad-id')
      } catch {
        // expected
      }
    })
    expect(result.current.error).toBe('Snapshot corrupted')
  })

  it('should delete a snapshot', async () => {
    const { snapshotsApi } = await import('@/api/snapshots')
    vi.mocked(snapshotsApi.deleteSnapshot).mockResolvedValueOnce({} as any)

    useProjectDataStore.setState({
      snapshots: [
        { id: 's1', name: 'Snap 1', created_at: 'a' },
        { id: 's2', name: 'Snap 2', created_at: 'b' },
      ],
    } as any)

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      await result.current.deleteSnapshot('s1')
    })
    expect(result.current.snapshots).toHaveLength(1)
    expect(result.current.snapshots[0].id).toBe('s2')
  })

  it('should handle deleteSnapshot error', async () => {
    const { snapshotsApi } = await import('@/api/snapshots')
    vi.mocked(snapshotsApi.deleteSnapshot).mockRejectedValueOnce(new Error('Permission denied'))

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      await result.current.deleteSnapshot('s1')
    })
    expect(result.current.error).toBe('Permission denied')
  })

  it('should trigger backup', async () => {
    const { snapshotsApi } = await import('@/api/snapshots')
    vi.mocked(snapshotsApi.triggerBackup).mockResolvedValueOnce({} as any)
    vi.mocked(snapshotsApi.getBackupStatus).mockResolvedValueOnce({
      last_backup: '2026-01-01',
      status: 'completed',
    } as any)

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      await result.current.triggerBackup()
    })
    expect(snapshotsApi.triggerBackup).toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  it('should export as JSON', async () => {
    const { exportImportApi } = await import('@/api/exportImport')
    vi.mocked(exportImportApi.exportProject).mockResolvedValueOnce({
      version: '1.0',
      characters: [{ name: 'Alice' }],
    } as any)

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      await result.current.exportJSON()
    })
    expect(result.current.exportData).toBeDefined()
    expect(result.current.loading).toBe(false)
  })

  it('should export as YAML', async () => {
    const { exportImportApi } = await import('@/api/exportImport')
    vi.mocked(exportImportApi.exportAsYaml).mockResolvedValueOnce({} as any)

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      await result.current.exportYAML()
    })
    expect(exportImportApi.exportAsYaml).toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  it('should export as ZIP', async () => {
    const { exportImportApi } = await import('@/api/exportImport')
    vi.mocked(exportImportApi.exportAsZip).mockResolvedValueOnce({} as any)

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      await result.current.exportZIP('json')
    })
    expect(exportImportApi.exportAsZip).toHaveBeenCalledWith({ format: 'json' })
  })

  it('should import from JSON', async () => {
    const { exportImportApi } = await import('@/api/exportImport')
    vi.mocked(exportImportApi.importProject).mockResolvedValueOnce({
      imported: { characters: 5, items: 3 },
    } as any)

    const { result } = renderHook(() => useProjectDataStore())
    const importData = { version: '1.0', characters: [], items: [] } as any
    await act(async () => {
      await result.current.importJSON(importData, 'merge')
    })
    expect(result.current.importResult).toBeDefined()
    expect(result.current.loading).toBe(false)
  })

  it('should import from YAML', async () => {
    const { exportImportApi } = await import('@/api/exportImport')
    vi.mocked(exportImportApi.importFromYaml).mockResolvedValueOnce({
      imported: { characters: 2 },
    } as any)

    const { result } = renderHook(() => useProjectDataStore())
    await act(async () => {
      await result.current.importYAML('yaml: data', 'replace')
    })
    expect(result.current.importResult).toBeDefined()
  })

  it('should import from ZIP', async () => {
    const { exportImportApi } = await import('@/api/exportImport')
    vi.mocked(exportImportApi.importFromZip).mockResolvedValueOnce({
      imported: { characters: 1 },
    } as any)

    const { result } = renderHook(() => useProjectDataStore())
    const blob = new Blob(['zip data'])
    await act(async () => {
      await result.current.importZIP(blob, 'merge')
    })
    expect(result.current.importResult).toBeDefined()
  })

  it('should clear error', () => {
    useProjectDataStore.setState({ error: 'some error' })
    const { result } = renderHook(() => useProjectDataStore())
    act(() => {
      result.current.clearError()
    })
    expect(result.current.error).toBeNull()
  })

  it('should clear import result', () => {
    useProjectDataStore.setState({ importResult: { imported: {} } as any })
    const { result } = renderHook(() => useProjectDataStore())
    act(() => {
      result.current.clearImportResult()
    })
    expect(result.current.importResult).toBeNull()
  })

  it('should clear export data', () => {
    useProjectDataStore.setState({ exportData: { version: '1.0' } as any })
    const { result } = renderHook(() => useProjectDataStore())
    act(() => {
      result.current.clearExportData()
    })
    expect(result.current.exportData).toBeNull()
  })
})

describe('projectDataStore selectors', () => {
  it('selectSnapshots returns snapshots array', () => {
    const state = { snapshots: [{ id: '1' }] } as any
    expect(selectSnapshots(state)).toHaveLength(1)
  })

  it('selectSnapshotCount returns count', () => {
    const state = { snapshots: [{ id: '1' }, { id: '2' }] } as any
    expect(selectSnapshotCount(state)).toBe(2)
  })

  it('selectBackupStatus returns backup status', () => {
    const state = { backupStatus: { status: 'idle' } } as any
    expect(selectBackupStatus(state)?.status).toBe('idle')
  })

  it('selectExportData returns export data', () => {
    const state = { exportData: { version: '1.0' } } as any
    expect(selectExportData(state)).toBeDefined()
  })

  it('selectImportResult returns import result', () => {
    const state = { importResult: { imported: {} } } as any
    expect(selectImportResult(state)).toBeDefined()
  })

  it('selectProjectDataLoading returns loading flag', () => {
    expect(selectProjectDataLoading({ loading: true } as any)).toBe(true)
    expect(selectProjectDataLoading({ loading: false } as any)).toBe(false)
  })

  it('selectProjectDataError returns error', () => {
    expect(selectProjectDataError({ error: 'fail' } as any)).toBe('fail')
    expect(selectProjectDataError({ error: null } as any)).toBeNull()
  })

  it('cleanupProjectDataStore resets all state', () => {
    useProjectDataStore.setState({
      snapshots: [{ id: '1' }] as any,
      currentSnapshot: { id: '1' } as any,
      backupStatus: { status: 'active' } as any,
      exportData: { version: '1' } as any,
      importResult: { imported: {} } as any,
      loading: true,
      error: 'err',
    })
    cleanupProjectDataStore()
    const state = useProjectDataStore.getState()
    expect(state.snapshots).toEqual([])
    expect(state.currentSnapshot).toBeNull()
    expect(state.backupStatus).toBeNull()
    expect(state.exportData).toBeNull()
    expect(state.importResult).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })
})
