/**
 * useInputInteractions — extract slash-command and #mention detection
 * + keyboard navigation handlers from InputField.
 *
 * Phase 0b.2 split: keeps index.tsx under the 300-line cap.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { MAX_INPUT_LENGTH, slashCommands } from './types'
import type { SlashCommand } from './types'
import type { ExtractedEntityLocal } from '@/store/chatStore'

export interface UseInputInteractionsOptions {
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onExportOutline?: () => void
  onClearChat?: () => void
  extractedEntities: ExtractedEntityLocal[]
}

export interface UseInputInteractionsResult {
  // State
  autocompleteVisible: boolean
  autocompleteQuery: string
  selectedIndex: number
  commandVisible: boolean
  commandQuery: string
  commandSelectedIndex: number
  mentionStartRef: React.MutableRefObject<number>
  commandStartRef: React.MutableRefObject<number>

  // Handlers
  handleTextareaChange: (value: string, cursorPos: number) => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  handleSelect: (entity: ExtractedEntityLocal) => void
  handleCommandSelect: (command: SlashCommand) => void
  handleBlur: () => void

  // Derived
  filteredCommands: SlashCommand[]
  filteredEntities: ExtractedEntityLocal[]
  closePopups: () => void
}

export function useInputInteractions({
  input,
  onInputChange,
  onSend,
  onExportOutline,
  onClearChat,
  extractedEntities,
}: UseInputInteractionsOptions): UseInputInteractionsResult {
  const [autocompleteVisible, setAutocompleteVisible] = useState(false)
  const [autocompleteQuery, setAutocompleteQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const autocompleteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mentionStartRef = useRef<number>(-1)

  const [commandVisible, setCommandVisible] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0)
  const commandStartRef = useRef<number>(-1)

  const filteredCommands = useMemo(() => {
    if (!commandQuery) return slashCommands
    const lower = commandQuery.toLowerCase()
    return slashCommands.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.label.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower),
    )
  }, [commandQuery])

  const filteredEntities = useMemo(() => {
    if (!autocompleteQuery) return extractedEntities
    const lower = autocompleteQuery.toLowerCase()
    return extractedEntities.filter((e) => e.name.toLowerCase().includes(lower))
  }, [extractedEntities, autocompleteQuery])

  const detectCommand = useCallback((value: string, cursorPos: number) => {
    const textBefore = value.slice(0, cursorPos)
    const slashIndex = textBefore.lastIndexOf('/')

    if (slashIndex === -1) {
      setCommandVisible(false)
      commandStartRef.current = -1
      return
    }
    if (slashIndex > 0 && !/\s/.test(value[slashIndex - 1])) {
      setCommandVisible(false)
      commandStartRef.current = -1
      return
    }
    const query = textBefore.slice(slashIndex + 1)
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

  const detectMention = useCallback((value: string, cursorPos: number) => {
    const textBefore = value.slice(0, cursorPos)
    const hashIndex = textBefore.lastIndexOf('#')

    if (hashIndex === -1) {
      setAutocompleteVisible(false)
      mentionStartRef.current = -1
      return
    }
    if (hashIndex > 0 && !/\s/.test(value[hashIndex - 1])) {
      setAutocompleteVisible(false)
      mentionStartRef.current = -1
      return
    }
    const query = textBefore.slice(hashIndex + 1)
    if (/\s/.test(query)) {
      setAutocompleteVisible(false)
      mentionStartRef.current = -1
      return
    }
    mentionStartRef.current = hashIndex
    setAutocompleteQuery(query)
    setSelectedIndex(0)
    if (autocompleteDebounceRef.current) {
      clearTimeout(autocompleteDebounceRef.current)
    }
    autocompleteDebounceRef.current = setTimeout(() => {
      setAutocompleteVisible(true)
    }, query.length === 0 ? 0 : 200)
  }, [])

  const handleCommandSelect = useCallback(
    (command: SlashCommand) => {
      setCommandVisible(false)
      setCommandQuery('')
      commandStartRef.current = -1

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
      if (command.preset) {
        onInputChange(command.preset)
        const preset = command.preset
        requestAnimationFrame(() => {
          const ta = document.activeElement as HTMLTextAreaElement | null
          if (ta && ta.tagName === 'TEXTAREA') {
            ta.setSelectionRange(preset.length, preset.length)
            ta.focus()
          }
        })
      }
    },
    [onInputChange, onExportOutline, onClearChat],
  )

  const handleSelect = useCallback(
    (entity: ExtractedEntityLocal, cursorPos: number) => {
      const before = input.slice(0, mentionStartRef.current)
      const after = input.slice(cursorPos)
      const newValue = `${before}#${entity.name} ${after}`
      if (newValue.length <= MAX_INPUT_LENGTH) {
        onInputChange(newValue)
      }
      setAutocompleteVisible(false)
      setAutocompleteQuery('')
      mentionStartRef.current = -1
    },
    [input, onInputChange],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        handleSelect(filteredEntities[selectedIndex], input.length)
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

  const handleTextareaChange = (value: string, cursorPos: number) => {
    onInputChange(value)
    detectMention(value, cursorPos)
    detectCommand(value, cursorPos)
  }

  const closePopups = useCallback(() => {
    setAutocompleteVisible(false)
    setCommandVisible(false)
  }, [])

  const handleBlur = () => {
    // Delay closing so click on popup can register
    setTimeout(() => {
      closePopups()
    }, 200)
  }

  useEffect(() => {
    return () => {
      if (autocompleteDebounceRef.current) {
        clearTimeout(autocompleteDebounceRef.current)
      }
    }
  }, [])

  // The Select from AutocompletePopup needs a cursor position; we provide
  // a thin wrapper that uses the current end of input as the cursor — the
  // textarea element itself knows the live cursor when the user clicks.
  const handleSelectWrapper = (entity: ExtractedEntityLocal) => {
    handleSelect(entity, input.length)
  }

  return {
    autocompleteVisible,
    autocompleteQuery,
    selectedIndex,
    commandVisible,
    commandQuery,
    commandSelectedIndex,
    mentionStartRef,
    commandStartRef,
    handleTextareaChange,
    handleKeyDown,
    handleSelect: handleSelectWrapper,
    handleCommandSelect,
    handleBlur,
    filteredCommands,
    filteredEntities,
    closePopups,
  }
}