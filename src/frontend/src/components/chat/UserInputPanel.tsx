import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Paperclip, X, FileText } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import type { Attachment } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { showSuccess, showError } from '@/utils/toastHelper'
import { getWebSocketClient } from '@/api/websocket'
import { Icon } from '@/components/ui/Icon'
import { InputField } from './InputField'
import { InputSuggestions } from './InputSuggestions'
import { InputActions } from './InputActions'
import { FirstTimeHint } from './FirstTimeHint'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

const ACCEPTED_TYPES = '.jpg,.jpeg,.png,.webp,.txt,.md,.pdf'
const MAX_SINGLE_FILE = 10 * 1024 * 1024 // 10MB
const MAX_TOTAL_ATTACHMENTS = 50 * 1024 * 1024 // 50MB

interface PendingAttachment {
  file: File
  previewUrl?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function readAttachments(files: PendingAttachment[]): Promise<Attachment[]> {
  return Promise.all(
    files.map(
      (pa) =>
        new Promise<Attachment>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              name: pa.file.name,
              type: pa.file.type,
              size: pa.file.size,
              content: reader.result as string,
            })
          }
          reader.onerror = () => reject(new Error(`Failed to read ${pa.file.name}`))

          if (isImageFile(pa.file)) {
            reader.readAsDataURL(pa.file)
          } else {
            reader.readAsText(pa.file)
          }
        })
    )
  )
}

export function UserInputPanel() {
  const [input, setInput] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { sendMessage, createSession, clearSession, sessionId, isLoading, isStreaming, error, messages, exportToOutline, pendingInput, setPendingInput } = useChatStore()
  const [showExportConfirm, setShowExportConfirm] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingAttachments.forEach((pa) => {
        if (pa.previewUrl) URL.revokeObjectURL(pa.previewUrl)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync pendingInput from store
  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput)
      setPendingInput('')
    }
  }, [pendingInput, setPendingInput])

  const validateFiles = useCallback((files: File[]): File[] => {
    const currentTotal = pendingAttachments.reduce((sum, pa) => sum + pa.file.size, 0)
    const valid: File[] = []

    for (const file of files) {
      if (file.size > MAX_SINGLE_FILE) {
        showError(`文件 "${file.name}" 超过 10MB 限制`)
        continue
      }
      if (currentTotal + valid.reduce((s, f) => s + f.size, 0) + file.size > MAX_TOTAL_ATTACHMENTS) {
        showError('附件总大小超过 50MB 限制')
        continue
      }
      valid.push(file)
    }

    return valid
  }, [pendingAttachments])

  const addFiles = useCallback(
    (files: File[]) => {
      const valid = validateFiles(files)
      if (valid.length === 0) return

      const newAttachments: PendingAttachment[] = valid.map((file) => ({
        file,
        previewUrl: isImageFile(file) ? URL.createObjectURL(file) : undefined,
      }))

      setPendingAttachments((prev) => [...prev, ...newAttachments])
    },
    [validateFiles]
  )

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => {
      const removed = prev[index]
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        addFiles(files)
      }
    },
    [addFiles]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        addFiles(files)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [addFiles]
  )

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleSend = useCallback(async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || isLoading || isStreaming) return

    let currentSessionId = sessionId
    if (!currentSessionId) {
      await createSession()
      currentSessionId = useChatStore.getState().sessionId
    }

    if (!currentSessionId) return

    const content = input.trim()
    setInput('')

    let attachments: Attachment[] | undefined
    if (pendingAttachments.length > 0) {
      try {
        attachments = await readAttachments(pendingAttachments)
      } catch {
        showError('读取附件失败，请重试')
        return
      }
      pendingAttachments.forEach((pa) => {
        if (pa.previewUrl) URL.revokeObjectURL(pa.previewUrl)
      })
      setPendingAttachments([])
    }

    const ws = getWebSocketClient()
    if (ws.isConnected) {
      ws.sendText(content || '(附件)', 'user')
    }

    await sendMessage(content || '(附件)', { attachments })
  }, [input, pendingAttachments, isLoading, isStreaming, sessionId, createSession, sendMessage])

  const handleNewChat = () => {
    pendingAttachments.forEach((pa) => {
      if (pa.previewUrl) URL.revokeObjectURL(pa.previewUrl)
    })
    setPendingAttachments([])
    clearSession()
    createSession()
  }

  const handleTemplateSelect = (message: string) => {
    setInput(message)
  }

  const handleQuickReply = useCallback((message: string) => {
    setInput(message)
    setTimeout(() => {
      const currentSessionId = sessionId || useChatStore.getState().sessionId
      if (currentSessionId) {
        const ws = getWebSocketClient()
        if (ws.isConnected) {
          ws.sendText(message, 'user')
        }
        sendMessage(message)
        setInput('')
      } else {
        createSession().then(() => {
          const ws = getWebSocketClient()
          if (ws.isConnected) {
            ws.sendText(message, 'user')
          }
          sendMessage(message)
          setInput('')
        })
      }
    }, 100)
  }, [sessionId, createSession, sendMessage])

  const handleExportOutline = async () => {
    const result = exportToOutline()
    if (result.entries.length > 0) {
      const { importFromChat } = useSettingsStore.getState()
      await importFromChat(result.entries)
      setShowExportConfirm(true)
      showSuccess(`已导出 ${result.entries.length} 个设定到设定编辑器`)
    }
  }

  useEffect(() => {
    if (showExportConfirm) {
      const timer = setTimeout(() => setShowExportConfirm(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showExportConfirm])

  const hasMessages = messages.length > 0
  const canSend = (input.trim() || pendingAttachments.length > 0) && !isLoading && !isStreaming

  return (
    <div
      className="relative flex flex-col gap-3 p-4 bg-surface-base border-t border-default"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center rounded-lg
                       bg-surface-base/90 border-2 border-dashed border-accent-primary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.FAST }}
          >
            <div className="flex flex-col items-center gap-2 text-accent-primary">
              <Icon icon={Paperclip} size="lg" />
              <span className="text-sm font-medium">松开以添加附件</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FirstTimeHint />

      <InputSuggestions
        hasMessages={hasMessages}
        isLoading={isLoading}
        isStreaming={isStreaming}
        showExportConfirm={showExportConfirm}
        onTemplateSelect={handleTemplateSelect}
        onQuickReply={handleQuickReply}
        onExportOutline={handleExportOutline}
      />

      {/* Attachment preview bar */}
      <AnimatePresence>
        {pendingAttachments.length > 0 && (
          <motion.div
            className="flex flex-wrap gap-2 p-2 rounded-lg bg-surface-raised border border-default"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          >
            {pendingAttachments.map((pa, index) => (
              <motion.div
                key={`${pa.file.name}-${index}`}
                className="relative flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-base border border-default/50 max-w-[200px]"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: DURATION.FAST }}
              >
                {pa.previewUrl ? (
                  <img
                    src={pa.previewUrl}
                    alt={pa.file.name}
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded flex items-center justify-center bg-surface-raised flex-shrink-0">
                    <Icon icon={FileText} size="sm" className="text-tertiary" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-primary truncate">{pa.file.name}</span>
                  <span className="text-[10px] text-tertiary">{formatFileSize(pa.file.size)}</span>
                </div>
                <button
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center
                             bg-surface-raised border border-default text-tertiary hover:text-primary hover:bg-surface-hover
                             transition-colors duration-100"
                  aria-label={`移除 ${pa.file.name}`}
                >
                  <Icon icon={X} size="xs" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      <InputField
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        onNewChat={handleNewChat}
        onAttachClick={handleAttachClick}
        onExportOutline={handleExportOutline}
        onClearChat={handleNewChat}
        isLoading={isLoading}
        isStreaming={isStreaming}
        canSend={!!canSend}
      />

      {/* Keyboard shortcut hints */}
      <motion.div
        className="flex items-center justify-center gap-4 text-[10px] text-tertiary/60 select-none"
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: DURATION.NORMAL, delay: 0.3, ease: EASE.SMOOTH }}
      >
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-surface-raised border border-default/50">Enter</kbd>
          <span>发送</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-surface-raised border border-default/50">Shift</kbd>
          <span>+</span>
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-surface-raised border border-default/50">Enter</kbd>
          <span>换行</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-surface-raised border border-default/50">Ctrl</kbd>
          <span>+</span>
          <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-surface-raised border border-default/50">S</kbd>
          <span>保存</span>
        </span>
      </motion.div>

      <InputActions error={error} />
    </div>
  )
}
