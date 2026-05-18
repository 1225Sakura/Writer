import { useState, useEffect } from 'react'
import { useAiProviderStore } from '@/store/aiProviderStore'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { Icon } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE, DURATION } from '@/components/shared/AnimationConfig'
import {
  TestTube, Check, Trash2, Eye, EyeOff,
  RefreshCw, AlertCircle, Zap, Loader2,
} from 'lucide-react'
import type { AIProviderConfigCreate, AIProviderConfigUpdate } from '@/api/types'

export function AIProviderPanel() {
  const {
    configs, isLoading, error, testResult,
    fetchConfigs, createConfig, updateConfig, deleteConfig,
    activateConfig, testConnection, testConnectionParams,
    clearTestResult, clearError,
  } = useAiProviderStore()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [form, setForm] = useState<AIProviderConfigCreate>({
    name: '',
    api_key: '',
    base_url: '',
    model_name: '',
    max_tokens: 4096,
    temperature: 0.7,
  })

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  const resetForm = () => {
    setForm({ name: '', api_key: '', base_url: '', model_name: '', max_tokens: 4096, temperature: 0.7 })
    setEditingId(null)
    clearTestResult()
  }

  const loadConfig = (id: number) => {
    const config = configs.find(c => c.id === id)
    if (config) {
      setForm({
        name: config.name,
        api_key: config.api_key,
        base_url: config.base_url,
        model_name: config.model_name,
        max_tokens: config.max_tokens,
        temperature: config.temperature,
      })
      setEditingId(id)
      clearTestResult()
    }
  }

  const handleSubmit = async () => {
    if (!form.name || !form.api_key || !form.base_url || !form.model_name) return
    if (editingId) {
      await updateConfig(editingId, form as AIProviderConfigUpdate)
    } else {
      const newId = await createConfig(form)
      if (newId) {
        await activateConfig(newId)
      }
    }
    resetForm()
  }

  const handleTestCurrent = async () => {
    if (!form.api_key || !form.base_url || !form.model_name) return
    await testConnectionParams({
      api_key: form.api_key,
      base_url: form.base_url,
      model_name: form.model_name,
      max_tokens: form.max_tokens,
      temperature: form.temperature,
    })
  }

  const handleActivate = async (id: number) => {
    await activateConfig(id)
  }

  const handleDelete = async (id: number) => {
    await deleteConfig(id)
    if (editingId === id) resetForm()
  }

  const isFormValid = form.name && form.api_key && form.base_url && form.model_name

  return (
    <div className="space-y-4">
      {/* Provider list */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          Provider 配置 ({configs.length})
        </h3>
        <Button onClick={() => fetchConfigs()} variant="ghost" size="sm" disabled={isLoading}>
          <Icon icon={RefreshCw} size="xs" />
        </Button>
      </div>

      {configs.length === 0 && !isLoading ? (
        <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">暂无 Provider 配置，请在下方添加</p>
      ) : (
        <div className="space-y-2">
          {configs.map((config) => (
            <GlassCard key={config.id} intensity="light" border="subtle" rounded="lg" padding="sm">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => loadConfig(config.id)}
                  className="min-w-0 flex-1 text-left group"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{config.name}</p>
                    {config.is_active && (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-success)]/10 text-[var(--color-success)]">
                        <Icon icon={Zap} size="xs" /> 活跃
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] truncate">{config.base_url}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">{config.model_name}</p>
                </button>
                <div className="flex gap-1 ml-2">
                  {!config.is_active && (
                    <Button onClick={() => handleActivate(config.id)} variant="ghost" size="sm" title="激活">
                      <Icon icon={Check} size="xs" />
                    </Button>
                  )}
                  <Button onClick={() => testConnection(config.id)} variant="ghost" size="sm" title="测试连接">
                    <Icon icon={TestTube} size="xs" />
                  </Button>
                  <Button onClick={() => handleDelete(config.id)} variant="ghost" size="sm" title="删除">
                    <Icon icon={Trash2} size="xs" className="text-[var(--color-error)]" />
                  </Button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Config form */}
      <GlassCard intensity="light" border="subtle" rounded="lg" padding="md">
        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
          {editingId ? '编辑 Provider' : '添加 Provider'}
        </h4>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Provider 名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="如 DeepSeek、OpenAI"
              className="w-full px-3 py-2 rounded-md bg-[var(--color-surface-overlay)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">API Key *</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={form.api_key}
                onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 rounded-md bg-[var(--color-surface-overlay)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                <Icon icon={showApiKey ? EyeOff : Eye} size="xs" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Base URL *</label>
            <input
              type="url"
              value={form.base_url}
              onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))}
              placeholder="https://api.deepseek.com/v1"
              className="w-full px-3 py-2 rounded-md bg-[var(--color-surface-overlay)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Model Name *</label>
            <input
              type="text"
              value={form.model_name}
              onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))}
              placeholder="deepseek-chat"
              className="w-full px-3 py-2 rounded-md bg-[var(--color-surface-overlay)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Max Tokens</label>
              <input
                type="number"
                value={form.max_tokens}
                onChange={e => setForm(f => ({ ...f, max_tokens: Number(e.target.value) }))}
                min={1}
                max={1000000}
                className="w-full px-3 py-2 rounded-md bg-[var(--color-surface-overlay)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Temperature</label>
              <input
                type="number"
                value={form.temperature}
                onChange={e => setForm(f => ({ ...f, temperature: Number(e.target.value) }))}
                min={0}
                max={2}
                step={0.1}
                className="w-full px-3 py-2 rounded-md bg-[var(--color-surface-overlay)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleTestCurrent}
              disabled={!isFormValid || isLoading}
              variant="ghost"
              size="sm"
            >
              <Icon icon={TestTube} size="xs" />
              <span className="ml-1">测试连接</span>
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || isLoading}
              variant="ghost"
              size="sm"
            >
              {isLoading ? <Icon icon={Loader2} size="xs" className="animate-spin" /> : <Icon icon={Check} size="xs" />}
              <span className="ml-1">{editingId ? '保存' : '保存并应用'}</span>
            </Button>
            {editingId && (
              <Button onClick={resetForm} variant="ghost" size="sm">
                取消
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Test result */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          >
            <GlassCard intensity="light" border="subtle" rounded="lg" padding="sm">
              <div className="flex items-center gap-2">
                <Icon
                  icon={testResult.success ? Check : AlertCircle}
                  size="sm"
                  className={testResult.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}
                />
                <span className={`text-sm ${testResult.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                  {testResult.message}
                </span>
                <span className="text-xs text-[var(--text-tertiary)] ml-auto">{testResult.latency_ms}ms</span>
              </div>
              {testResult.error_detail && (
                <p className="text-xs text-[var(--text-tertiary)] mt-1 truncate">{testResult.error_detail}</p>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

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
    </div>
  )
}
