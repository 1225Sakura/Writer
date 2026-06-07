import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, RefreshCw, BookOpen, Users, ScrollText, MapPin, Swords, Settings, PenTool, Paperclip, Mic, FileText, Trash2, HelpCircle } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useChatStore } from '@/store/chatStore'
import type { ExtractedEntityLocal } from '@/store/chatStore'
import { typeColors } from '@/lib/entityColors'

const MAX_INPUT_LENGTH = 500

/* ============================================================
   SLASH COMMANDS
   ============================================================ */

interface SlashCommand {
  name: string
  label: string
  description: string
  icon: React.ElementType
  /** Preset text to fill into the input when selected */
  preset?: string
  /** Action to execute when selected (instead of filling text) */
  action?: 'export' | 'clear' | 'help'
}

const slashCommands: SlashCommand[] = [
  { name: '/世界观', label: '世界观', description: '生成世界观设定', icon: BookOpen, preset: '请帮我构建完整的世界观设定，包括地理、历史、文明和世界规则。' },
  { name: '/角色', label: '角色', description: '创建角色设定', icon: Users, preset: '请帮我创建角色设定，包括姓名、性格、背景故事和能力。' },
  { name: '/物品', label: '物品', description: '设计重要物品', icon: ScrollText, preset: '请帮我设计故事中的重要物品，包括名称、来历、特殊属性和在剧情中的作用。' },
  { name: '/导出', label: '导出', description: '导出设定到大纲', icon: FileText, action: 'export' },
  { name: '/清空', label: '清空', description: '清空当前对话', icon: Trash2, action: 'clear' },
  { name: '/帮助', label: '帮助', description: '查看可用命令', icon: HelpCircle, action: 'help' },
]

/* ============================================================
   COMMAND PALETTE POPUP
   ============================================================ */

interface CommandPaletteProps {
  commands: SlashCommand[]
  query: string
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
  visible: boolean
}

function CommandPalette({ commands, query, selectedIndex, onSelect, visible }: CommandPaletteProps) {
  const filtered = useMemo(() => {
    if (!query) return commands
    const lower = query.toLowerCase()
    return commands.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.label.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower)
    )
  }, [commands, query])

  if (!visible || filtered.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      className="absolute bottom-full left-0 right-0 mb-2 z-50"
    >
      <div
        className="rounded-xl overflow-hidden border border-default shadow-lg"
        style={{
          maxHeight: '240px',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface-raised)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Header */}
        <div
          className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider select-none"
          style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--color-surface-input)' }}
        >
          命令
        </div>
        {/* Command items */}
        {filtered.map((command, i) => {
          const CommandIcon = command.icon
          const isSelected = i === selectedIndex
          return (
            <div
              key={command.name}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-sm"
              style={{
                backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : undefined,
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(command)
              }}
            >
              <CommandIcon size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <span className="font-medium text-primary">{command.label}</span>
              <span className="text-xs text-tertiary flex-1 min-w-0 truncate">{command.description}</span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ============================================================
   TYPE LABELS & ICONS (shared with WelcomePanel)
   ============================================================ */

const typeLabels: Record<string, string> = {
  world: '世界观',
  character: '角色',
  item: '物品',
  location: '地点',
  faction: '势力',
  rule: '规则',
  ifline: 'IF线',
}

const typeIcons: Record<string, React.ElementType> = {
  world: BookOpen,
  character: Users,
  item: ScrollText,
  location: MapPin,
  faction: Swords,
  rule: Settings,
  ifline: PenTool,
}

const allTypes = ['world', 'character', 'item', 'location', 'faction', 'rule', 'ifline']

/* ============================================================
   AUTOCOMPLETE POPUP
   ============================================================ */

interface AutocompletePopupProps {
  entities: ExtractedEntityLocal[]
  query: string
  selectedIndex: number
  onSelect: (entity: ExtractedEntityLocal) => void
  visible: boolean
}

function AutocompletePopup({ entities, query, selectedIndex, onSelect, visible }: AutocompletePopupProps) {
  // Filter by query (fuzzy match on name)
  const filtered = useMemo(() => {
    if (!query) return entities
    const lower = query.toLowerCase()
    return entities.filter((e) => e.name.toLowerCase().includes(lower))
  }, [entities, query])

  // Group by type, preserving order
  const grouped = useMemo(() => {
    const groups: { type: string; entities: ExtractedEntityLocal[] }[] = []
    for (const type of allTypes) {
      const typeEntities = filtered.filter((e) => e.type === type)
      if (typeEntities.length > 0) {
        groups.push({ type, entities: typeEntities })
      }
    }
    return groups
  }, [filtered])

  // Flatten for keyboard navigation
  const flatList = useMemo(() => {
    return grouped.flatMap((g) => g.entities)
  }, [grouped])

  if (!visible || flatList.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      className="absolute bottom-full left-0 right-0 mb-2 z-50"
    >
      <div
        className="rounded-xl overflow-hidden border border-default shadow-lg"
        style={{
          maxHeight: '200px',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface-raised)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {grouped.map(({ type, entities: typeEntities }) => {
          const TypeIcon = typeIcons[type] || BookOpen
          const color = typeColors[type] || 'var(--color-character)'
          return (
            <div key={type}>
              {/* Type header */}
              <div
                className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider select-none"
                style={{
                  color: 'var(--text-tertiary)',
                  backgroundColor: 'var(--color-surface-input)',
                }}
              >
                <span className="flex items-center gap-1.5">
                  <span style={{ color }}>{typeLabels[type] || type}</span>
                </span>
              </div>
              {/* Entity items */}
              {typeEntities.map((entity) => {
                const flatIndex = flatList.indexOf(entity)
                const isSelected = flatIndex === selectedIndex
                return (
                  <div
                    key={entity.id}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-sm"
                    style={{
                      backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : undefined,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onSelect(entity)
                    }}
                  >
                    <TypeIcon
                      size={14}
                      style={{ color, flexShrink: 0 }}
                    />
                    <span className="font-medium text-primary truncate">{entity.name}</span>
                    {entity.description && (
                      <span className="text-xs text-tertiary truncate flex-1 min-w-0">
                        {entity.description.length > 30
                          ? entity.description.slice(0, 30) + '...'
                          : entity.description}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ============================================================
   VOICE RECOGNITION HOOK
   ============================================================ */

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionConstructor | null
}

const speechSupported = !!getSpeechRecognition()

function useVoiceRecognition(onResult: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const finalTranscriptRef = useRef('')

  const toggleRecording = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) return

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      setIsRecording(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    finalTranscriptRef.current = ''

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript
        } else {
          interim += transcript
        }
      }
      onResult(finalTranscriptRef.current + interim)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[VoiceInput] Speech recognition error:', event.error)
      recognitionRef.current = null
      setIsRecording(false)
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }, [onResult])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  return { isRecording, toggleRecording, speechSupported }
}

/* ============================================================
   INPUT FIELD
   ============================================================ */

interface InputFieldProps {
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onNewChat: () => void
  onAttachClick?: () => void
  onExportOutline?: () => void
  onClearChat?: () => void
  isLoading: boolean
  isStreaming: boolean
  canSend: boolean
}

export function InputField({
  input,
  onInputChange,
  onSend,
  onNewChat,
  onAttachClick,
  onExportOutline,
  onClearChat,
  isLoading,
  isStreaming,
  canSend,
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Autocomplete state
  const [autocompleteVisible, setAutocompleteVisible] = useState(false)
  const [autocompleteQuery, setAutocompleteQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const autocompleteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mentionStartRef = useRef<number>(-1)

  // Slash command state
  const [commandVisible, setCommandVisible] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0)
  const commandStartRef = useRef<number>(-1)

  const extractedEntities = useChatStore((state) => state.extractedEntities)

  // Voice recognition
  const handleVoiceResult = useCallback(
    (text: string) => {
      if (text.length <= MAX_INPUT_LENGTH) {
        onInputChange(text)
      }
    },
    [onInputChange]
  )
  const { isRecording, toggleRecording, speechSupported } = useVoiceRecognition(handleVoiceResult)

  // Filtered commands for the palette
  const filteredCommands = useMemo(() => {
    if (!commandQuery) return slashCommands
    const lower = commandQuery.toLowerCase()
    return slashCommands.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.label.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower)
    )
  }, [commandQuery])

  // Detect / trigger for command palette
  const detectCommand = useCallback((value: string, cursorPos: number) => {
    const textBefore = value.slice(0, cursorPos)
    const slashIndex = textBefore.lastIndexOf('/')

    if (slashIndex === -1) {
      setCommandVisible(false)
      commandStartRef.current = -1
      return
    }

    // Ensure / is at start or preceded by whitespace
    if (slashIndex > 0 && !/\s/.test(value[slashIndex - 1])) {
      setCommandVisible(false)
      commandStartRef.current = -1
      return
    }

    // Extract query after /
    const query = textBefore.slice(slashIndex + 1)

    // If query contains whitespace, close
    if (/\s/.test(query)) {
      setCommandVisible(false)
      commandStartRef.current = -1
      return
    }

    commandStartRef.current = slashIndex
    setCommandQuery(query)
    setCommandSelectedIndex(0)
    setCommandVisible(true)
  }, [])

  // Handle command selection
  const handleCommandSelect = useCallback((command: SlashCommand) => {
    setCommandVisible(false)
    setCommandQuery('')
    commandStartRef.current = -1

    // Execute action commands
    if (command.action === 'export' && onExportOutline) {
      onExportOutline()
      onInputChange('')
      return
    }
    if (command.action === 'clear' && onClearChat) {
      onClearChat()
      onInputChange('')
      return
    }
    if (command.action === 'help') {
      onInputChange('可用命令：/世界观 /角色 /物品 /导出 /清空 /帮助')
      return
    }

    // Fill preset text for content commands
    if (command.preset) {
      onInputChange(command.preset)
      // Focus textarea at end
      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (textarea) {
          textarea.setSelectionRange(command.preset!.length, command.preset!.length)
          textarea.focus()
        }
      })
    }
  }, [onInputChange, onExportOutline, onClearChat])

  // Filtered entities for the popup (same logic as AutocompletePopup)
  const filteredEntities = useMemo(() => {
    if (!autocompleteQuery) return extractedEntities
    const lower = autocompleteQuery.toLowerCase()
    return extractedEntities.filter((e) => e.name.toLowerCase().includes(lower))
  }, [extractedEntities, autocompleteQuery])

  // Detect # trigger and extract query
  const detectMention = useCallback((value: string, cursorPos: number) => {
    // Walk backwards from cursor to find #
    const textBefore = value.slice(0, cursorPos)
    const hashIndex = textBefore.lastIndexOf('#')

    if (hashIndex === -1) {
      setAutocompleteVisible(false)
      mentionStartRef.current = -1
      return
    }

    // Ensure # is at start or preceded by whitespace
    if (hashIndex > 0 && !/\s/.test(value[hashIndex - 1])) {
      setAutocompleteVisible(false)
      mentionStartRef.current = -1
      return
    }

    // Extract query after #
    const query = textBefore.slice(hashIndex + 1)

    // If query contains whitespace (user finished typing the mention), close
    if (/\s/.test(query)) {
      setAutocompleteVisible(false)
      mentionStartRef.current = -1
      return
    }

    mentionStartRef.current = hashIndex
    setAutocompleteQuery(query)
    setSelectedIndex(0)

    // Debounce show
    if (autocompleteDebounceRef.current) {
      clearTimeout(autocompleteDebounceRef.current)
    }
    autocompleteDebounceRef.current = setTimeout(() => {
      setAutocompleteVisible(true)
    }, query.length === 0 ? 0 : 200)
  }, [])

  // Handle entity selection
  const handleSelect = useCallback((entity: ExtractedEntityLocal) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const before = input.slice(0, mentionStartRef.current)
    const after = input.slice(cursorPos)
    const newValue = `${before}#${entity.name} ${after}`

    if (newValue.length <= MAX_INPUT_LENGTH) {
      onInputChange(newValue)
    }

    setAutocompleteVisible(false)
    setAutocompleteQuery('')
    mentionStartRef.current = -1

    // Set cursor position after the inserted mention
    requestAnimationFrame(() => {
      const newPos = mentionStartRef.current + entity.name.length + 2 // #name + space
      textarea.setSelectionRange(newPos, newPos)
      textarea.focus()
    })
  }, [input, onInputChange])

  // Enhanced keyDown handler with autocomplete + command palette navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Command palette navigation (takes priority when visible)
    if (commandVisible && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCommandSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCommandSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleCommandSelect(filteredCommands[commandSelectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setCommandVisible(false)
        return
      }
    }

    // Entity mention autocomplete navigation
    if (autocompleteVisible && filteredEntities.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredEntities.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSelect(filteredEntities[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setAutocompleteVisible(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (autocompleteDebounceRef.current) {
        clearTimeout(autocompleteDebounceRef.current)
      }
    }
  }, [])

  const charCount = input.length
  const isNearLimit = charCount >= MAX_INPUT_LENGTH * 0.9
  const isAtLimit = charCount >= MAX_INPUT_LENGTH

  return (
    <div className="flex gap-2 items-end">
      {/* New chat button */}
      <motion.button
        className="min-w-11 min-h-11 flex-shrink-0 rounded-xl bg-surface-raised border border-default touch-target-min
                   flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-hover"
        title="开始新对话"
        onClick={onNewChat}
        whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        <Icon icon={RefreshCw} size="md" />
      </motion.button>

      {/* Attach button */}
      {onAttachClick && (
        <motion.button
          className="min-w-11 min-h-11 flex-shrink-0 rounded-xl bg-surface-raised border border-default touch-target-min
                     flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-hover"
          title="添加附件 (图片/文档)"
          onClick={onAttachClick}
          whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        >
          <Icon icon={Paperclip} size="md" />
        </motion.button>
      )}

      {/* Voice input button */}
      {speechSupported && (
        <motion.button
          className="min-w-11 min-h-11 flex-shrink-0 rounded-xl border touch-target-min
                     flex items-center justify-center transition-colors duration-150"
          style={{
            backgroundColor: isRecording ? 'var(--color-danger)' : 'var(--color-surface-raised)',
            borderColor: isRecording ? 'var(--color-danger)' : 'var(--border-default)',
            color: isRecording ? 'white' : 'var(--text-secondary)',
          }}
          title={isRecording ? '停止录音' : '语音输入'}
          onClick={toggleRecording}
          whileHover={prefersReducedMotion ? {} : { scale: 1.06 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
          animate={
            isRecording && !prefersReducedMotion
              ? {
                  boxShadow: [
                    '0 0 0 0 rgba(220, 38, 38, 0.4)',
                    '0 0 0 8px rgba(220, 38, 38, 0)',
                  ],
                }
              : { boxShadow: '0 0 0 0 rgba(220, 38, 38, 0)' }
          }
          transition={
            isRecording && !prefersReducedMotion
              ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
              : { duration: DURATION.FAST, ease: EASE.SMOOTH }
          }
        >
          <Icon icon={Mic} size="md" />
        </motion.button>
      )}

      {/* Input area with enhanced focus effects */}
      <div className="flex-1 relative min-w-0">
        {/* Command palette popup */}
        <AnimatePresence>
          {commandVisible && filteredCommands.length > 0 && (
            <CommandPalette
              commands={slashCommands}
              query={commandQuery}
              selectedIndex={commandSelectedIndex}
              onSelect={handleCommandSelect}
              visible={commandVisible}
            />
          )}
        </AnimatePresence>

        {/* Autocomplete popup */}
        <AnimatePresence>
          {autocompleteVisible && extractedEntities.length > 0 && (
            <AutocompletePopup
              entities={extractedEntities}
              query={autocompleteQuery}
              selectedIndex={selectedIndex}
              onSelect={handleSelect}
              visible={autocompleteVisible}
            />
          )}
        </AnimatePresence>

        <motion.div
          className="relative"
          animate={{
            boxShadow: isFocused
              ? '0 0 0 2px var(--accent-primary), 0 0 0 4px var(--accent-muted), 0 0 24px var(--glow-primary-sm)'
              : '0 0 0 1px var(--border-default), 0 2px 8px color-mix(in srgb, var(--ink-100) 4%, transparent)',
          }}
          transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
          style={{ borderRadius: 'var(--radius-xl)' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              if (e.target.value.length <= MAX_INPUT_LENGTH) {
                onInputChange(e.target.value)
                detectMention(e.target.value, e.target.selectionStart)
                detectCommand(e.target.value, e.target.selectionStart)
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false)
              // Delay closing so click on popup can register
              setTimeout(() => {
                setAutocompleteVisible(false)
                setCommandVisible(false)
              }, 200)
            }}
            placeholder="输入你的回答... (Enter 发送，Shift+Enter 换行，#提及实体)"
            className="w-full resize-none min-h-[48px] max-h-32 py-3 px-4 pr-16 text-sm
                       bg-surface-input text-primary font-sans rounded-xl
                       border-2 outline-none transition-all duration-150
                       placeholder:text-tertiary"
            style={{
              borderColor: isFocused ? 'var(--accent-primary)' : 'var(--border-default)',
            }}
            rows={1}
          />

          {/* Character counter */}
          <motion.div
            className="absolute bottom-2 right-12 pointer-events-none select-none"
            initial={{ opacity: 0, y: 4 }}
            animate={{
              opacity: isFocused || isNearLimit ? 1 : 0,
              y: 0,
              color: isAtLimit
                ? 'var(--color-danger)'
                : isNearLimit
                  ? 'var(--color-warning)'
                  : 'var(--text-tertiary)'
            }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          >
            <span
              className="text-xs font-mono tabular-nums"
              style={{
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
              }}
            >
              {charCount}/{MAX_INPUT_LENGTH}
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* Send button with glow effect */}
      <motion.button
        onClick={onSend}
        disabled={!canSend}
        className="px-5 py-2.5 flex items-center gap-2 text-sm font-medium flex-shrink-0
                   rounded-xl text-primary disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-150 relative overflow-hidden touch-target-min"
        style={{
          backgroundColor: canSend ? 'var(--accent-primary)' : 'var(--color-surface-input)',
          border: canSend ? '1px solid transparent' : '1px solid var(--border-default)',
          color: canSend ? 'white' : 'var(--text-secondary)',
        }}
        whileHover={canSend && !prefersReducedMotion ? {
          scale: 1.04,
          boxShadow: '0 0 24px color-mix(in srgb, var(--accent-primary) 40%, transparent), 0 4px 12px color-mix(in srgb, var(--accent-primary) 20%, transparent)',
        } : {}}
        whileTap={canSend && !prefersReducedMotion ? { scale: 0.95 } : {}}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      >
        {isLoading || isStreaming ? (
          <motion.div
            animate={prefersReducedMotion ? {} : { rotate: 360 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Icon icon={Loader2} size="sm" />
          </motion.div>
        ) : (
          <Icon icon={Send} size="sm" />
        )}
        <span>{isLoading || isStreaming ? '发送中...' : '发送'}</span>
      </motion.button>
    </div>
  )
}
