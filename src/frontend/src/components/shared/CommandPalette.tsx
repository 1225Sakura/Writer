import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '@/store'
import {
  FilePlus,
  MessageCircle,
  Users,
  List,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  Keyboard,
  Search,
  Eye,
  EyeOff,
} from 'lucide-react'

interface Command {
  id: string
  label: string
  shortcut?: string
  icon: React.ReactNode
  action: () => void
  category: 'file' | 'view' | 'ai' | 'theme'
}

function fuzzyMatch(query: string, text: string): boolean {
  const lowerQuery = query.toLowerCase()
  const lowerText = text.toLowerCase()
  let queryIndex = 0
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++
    }
  }
  return queryIndex === lowerQuery.length
}

function highlightMatch(query: string, text: string): React.ReactNode {
  if (!query) return text
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const result: React.ReactNode[] = []
  let queryIndex = 0
  let lastIndex = 0

  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      if (i > lastIndex) {
        result.push(text.slice(lastIndex, i))
      }
      result.push(
        <span key={i} className="text-white font-medium">
          {text[i]}
        </span>
      )
      lastIndex = i + 1
      queryIndex++
    }
  }
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex))
  }
  return result.length > 0 ? result : text
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const {
    toggleAIDrawer,
    toggleCollaborationDrawer,
    toggleOutlineDrawer,
    toggleTheme,
    theme,
    toggleImmersiveMode,
    immersiveMode,
    toggleFocusMode,
    focusModeEnabled,
  } = useUIStore()

  const inputRef = useRef<HTMLInputElement>(null)

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setSearch('')
        setSelectedIndex(0)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSelectedIndex(0)
    } else {
      setSearch('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  const commands: Command[] = useMemo(() => [
    {
      id: 'new-chapter',
      label: '新建章节',
      icon: <FilePlus className="w-4 h-4" />,
      category: 'file',
      action: () => {
        // TODO: Implement new chapter
        setIsOpen(false)
      },
    },
    {
      id: 'toggle-ai-drawer',
      label: '切换AI操作面板',
      shortcut: 'Ctrl+\\',
      icon: <MessageCircle className="w-4 h-4" />,
      category: 'ai',
      action: () => {
        toggleAIDrawer()
        setIsOpen(false)
      },
    },
    {
      id: 'toggle-collaboration',
      label: '切换协作面板',
      shortcut: 'Ctrl+/',
      icon: <Users className="w-4 h-4" />,
      category: 'ai',
      action: () => {
        toggleCollaborationDrawer()
        setIsOpen(false)
      },
    },
    {
      id: 'toggle-outline',
      label: '切换大纲面板',
      icon: <List className="w-4 h-4" />,
      category: 'view',
      action: () => {
        toggleOutlineDrawer()
        setIsOpen(false)
      },
    },
    {
      id: 'toggle-theme',
      label: `切换${theme === 'dark' ? '浅色' : '深色'}模式`,
      icon: theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
      category: 'theme',
      action: () => {
        toggleTheme()
        setIsOpen(false)
      },
    },
    {
      id: 'toggle-immersive',
      label: immersiveMode ? '退出沉浸模式' : '进入沉浸模式',
      icon: immersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />,
      category: 'view',
      action: () => {
        toggleImmersiveMode()
        setIsOpen(false)
      },
    },
    {
      id: 'toggle-focus-mode',
      label: focusModeEnabled ? '退出专注模式' : '进入专注模式',
      icon: focusModeEnabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
      category: 'view',
      action: () => {
        toggleFocusMode()
        setIsOpen(false)
      },
    },
  ], [
    toggleAIDrawer,
    toggleCollaborationDrawer,
    toggleOutlineDrawer,
    toggleTheme,
    theme,
    toggleImmersiveMode,
    immersiveMode,
    toggleFocusMode,
    focusModeEnabled,
  ])

  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands
    return commands.filter((cmd) => fuzzyMatch(search, cmd.label))
  }, [commands, search])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault()
        filteredCommands[selectedIndex].action()
      }
    },
    [filteredCommands, selectedIndex]
  )

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => {
    setIsOpen(false)
    setSearch('')
    setSelectedIndex(0)
  }, [])

  return {
    isOpen,
    search,
    setSearch,
    selectedIndex,
    setSelectedIndex,
    filteredCommands,
    inputRef,
    handleKeyDown,
    open,
    close,
  }
}

export function CommandPalette() {
  const {
    isOpen,
    search,
    setSearch,
    selectedIndex,
    setSelectedIndex,
    filteredCommands,
    inputRef,
    handleKeyDown,
    close,
  } = useCommandPalette()

  const categoryLabels: Record<Command['category'], string> = {
    file: '文件',
    view: '视图',
    ai: 'AI操作',
    theme: '主题',
  }

  if (!isOpen) return null

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={close}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal - Linear style */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1a1e] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
          <Search className="w-4 h-4 text-[#8a8f98] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="输入命令或搜索..."
            className="flex-1 bg-transparent text-sm text-[#d0d6e0] placeholder:text-[#8a8f98] focus:outline-none font-[510]"
          />
          <div className="flex items-center gap-1 text-xs text-[#8a8f98]">
            <Keyboard className="w-3 h-3" />
            <span>ESC</span>
          </div>
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#8a8f98]">
              未找到匹配的命令
            </div>
          ) : (
            // Group by category
            (() => {
              const grouped: Record<string, Command[]> = {}
              for (const cmd of filteredCommands) {
                if (!grouped[cmd.category]) grouped[cmd.category] = []
                grouped[cmd.category].push(cmd)
              }

              let globalIndex = 0
              return Object.entries(grouped).map(([category, cmds]) => (
                <div key={category}>
                  <div className="px-4 py-1.5 text-xs font-medium text-[#8a8f98] uppercase tracking-wider">
                    {categoryLabels[category as Command['category']]}
                  </div>
                  {cmds.map((cmd) => {
                    const currentIndex = globalIndex++
                    const isSelected = currentIndex === selectedIndex
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => cmd.action()}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                          isSelected
                            ? 'bg-[#3f3f46] text-white'
                            : 'text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.04)]'
                        }`}
                      >
                        <span className="text-[#8a8f98] flex-shrink-0">{cmd.icon}</span>
                        <span className="flex-1">{highlightMatch(search, cmd.label)}</span>
                        {cmd.shortcut && (
                          <span className="text-xs text-[#8a8f98] font-mono">
                            {cmd.shortcut}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            })()
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[rgba(255,255,255,0.08)] flex items-center gap-4 text-xs text-[#8a8f98]">
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[rgba(255,255,255,0.1)] text-[10px]">↑</span>
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[rgba(255,255,255,0.1)] text-[10px]">↓</span>
            导航
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[rgba(255,255,255,0.1)] text-[10px]">↵</span>
            执行
          </span>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
