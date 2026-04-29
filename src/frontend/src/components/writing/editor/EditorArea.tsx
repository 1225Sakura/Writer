import { useState } from 'react'
import { showToast } from '@/components/ui/Toast'
import { Save, CheckCircle, AlertCircle } from 'lucide-react'

export function formatTime(timestamp: number | null): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export function SaveStatusIndicator({ status, lastSavedAt }: { status: string; lastSavedAt: number | null }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
        <Save className="w-3 h-3 animate-pulse motion-reduce:animate-none" />
        保存中...
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1" style={{ color: 'var(--color-ifline)' }} title={`上次保存: ${formatTime(lastSavedAt)}`}>
        <CheckCircle className="w-3 h-3" />
        已保存 {lastSavedAt ? formatTime(lastSavedAt) : ''}
      </span>
    )
  }
  if (status === 'unsaved') {
    return (
      <span className="flex items-center gap-1" style={{ color: 'var(--color-vermillion)' }}>
        <AlertCircle className="w-3 h-3" />
        未保存
      </span>
    )
  }
  return null
}