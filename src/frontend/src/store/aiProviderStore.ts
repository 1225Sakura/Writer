import { create } from 'zustand'
import { showOperationError } from '../utils/toastHelper'
import { aiProviderConfigApi } from '../api/settings'
import type {
  AIProviderConfig,
  AIProviderConfigCreate,
  AIProviderConfigUpdate,
  AIProviderConfigTest,
  ConnectionTestResult,
} from '../api/types'

interface AIProviderState {
  configs: AIProviderConfig[]
  activeConfig: AIProviderConfig | null
  isLoading: boolean
  error: string | null
  testResult: ConnectionTestResult | null
}

interface AIProviderActions {
  fetchConfigs: (projectId?: number) => Promise<void>
  createConfig: (data: AIProviderConfigCreate) => Promise<number | null>
  updateConfig: (id: number, data: AIProviderConfigUpdate) => Promise<void>
  deleteConfig: (id: number) => Promise<void>
  activateConfig: (id: number) => Promise<void>
  testConnection: (id: number) => Promise<void>
  testConnectionParams: (data: AIProviderConfigTest) => Promise<void>
  clearTestResult: () => void
  clearError: () => void
}

export const useAiProviderStore = create<AIProviderState & AIProviderActions>((set, get) => ({
  configs: [],
  activeConfig: null,
  isLoading: false,
  error: null,
  testResult: null,

  fetchConfigs: async (projectId?: number) => {
    set({ isLoading: true, error: null })
    try {
      const configs = await aiProviderConfigApi.list(projectId)
      const activeConfig = configs.find(c => c.is_active) || null
      set({ configs, activeConfig, isLoading: false })
    } catch (err: any) {
      set({ error: err?.message || 'Failed to fetch configs', isLoading: false })
      showOperationError('获取配置列表', err)
    }
  },

  createConfig: async (data: AIProviderConfigCreate): Promise<number | null> => {
    set({ isLoading: true, error: null })
    try {
      const created = await aiProviderConfigApi.create(data)
      await get().fetchConfigs(data.project_id ?? undefined)
      return created.id
    } catch (err: any) {
      set({ error: err?.message || 'Failed to create config', isLoading: false })
      showOperationError('创建配置', err)
      return null
    }
  },

  updateConfig: async (id: number, data: AIProviderConfigUpdate) => {
    set({ isLoading: true, error: null })
    try {
      await aiProviderConfigApi.update(id, data)
      await get().fetchConfigs()
    } catch (err: any) {
      set({ error: err?.message || 'Failed to update config', isLoading: false })
      showOperationError('更新配置', err)
    }
  },

  deleteConfig: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      await aiProviderConfigApi.delete(id)
      await get().fetchConfigs()
    } catch (err: any) {
      set({ error: err?.message || 'Failed to delete config', isLoading: false })
      showOperationError('删除配置', err)
    }
  },

  activateConfig: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      await aiProviderConfigApi.activate(id)
      await get().fetchConfigs()
    } catch (err: any) {
      set({ error: err?.message || 'Failed to activate config', isLoading: false })
      showOperationError('激活配置', err)
    }
  },

  testConnection: async (id: number) => {
    set({ testResult: null, error: null })
    try {
      const result = await aiProviderConfigApi.testConnection(id)
      set({ testResult: result })
    } catch (err: any) {
      set({ error: err?.message || 'Connection test failed' })
      showOperationError('连接测试', err)
    }
  },

  testConnectionParams: async (data: AIProviderConfigTest) => {
    set({ testResult: null, error: null })
    try {
      const result = await aiProviderConfigApi.testConnectionParams(data)
      set({ testResult: result })
    } catch (err: any) {
      set({ error: err?.message || 'Connection test failed' })
      showOperationError('连接测试', err)
    }
  },

  clearTestResult: () => set({ testResult: null }),
  clearError: () => set({ error: null }),
}))
