/**
 * CommandPalette — Enhanced command palette with glowing search,
 * gradient hover effects, elegant kbd shortcuts, and refined empty state
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore, useWritingStore, useSettingsStore, useChatStore } from '@/store'
import { showToast } from '@/components/ui/Toast'
import { motion } from 'framer-motion'
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
  Home,
  Settings,
  PenTool,
  Sparkles,
  Wand2,
  Scissors,
  RefreshCw,
  BookOpen,
  User,
  MapPin,
  Shield,
  Globe,
  GitBranch,
  Save,
  Command,
  X,
  ArrowRight,
  Feather,
} from 'lucide-react'
import type { AIOperationType } from '@/constants/shortcuts'

// ============ 类型定义 ============
type CommandCategory =
  | 'navigation'
  | 'file'
  | 'view'
  | 'ai'
  | 'theme'
  | 'settings'
  | 'search'
  | 'system'

interface CommandItem {
  id: string
  label: string
  shortcut?: string
  icon: React.ReactNode
  action: () => void
  category: CommandCategory
  keywords?: string[] // 额外搜索关键词
  disabled?: boolean
}

// ============ 分类显示名称 ============
const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: '导航',
  file: '文件',
  view: '视图',
  ai: 'AI操作',
  theme: '主题',
  settings: '设定',
  search: '搜索',
  system: '系统',
}

const CATEGORY_ORDER: CommandCategory[] = [
  'navigation',
  'file',
  'view',
  'ai',
  'settings',
  'search',
  'theme',
  'system',
]

/** Category accent colors for visual distinction */
const CATEGORY_COLORS: Record<CommandCategory, string> = {
  navigation: 'var(--accent-primary)',
  file: 'var(--color-success)',
  view: 'var(--color-info)',
  ai: 'var(--color-warning)',
  theme: 'var(--color-item)',
  settings: 'var(--color-character)',
  search: 'var(--color-location)',
  system: 'var(--text-tertiary)',
}

// ============ 模糊搜索 ============
function fuzzyMatch(query: string, text: string, keywords?: string[]): boolean {
  const lowerQuery = query.toLowerCase().trim()
  if (!lowerQuery) return true

  const lowerText = text.toLowerCase()
  let queryIndex = 0
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++
    }
  }
  if (queryIndex === lowerQuery.length) return true

  // 搜索关键词
  if (keywords) {
    for (const kw of keywords) {
      if (kw.toLowerCase().includes(lowerQuery)) return true
    }
  }
  return false
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
        <span key={i} className="font-semibold" style={{ color: 'var(--text-primary)' }}>
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

// ============ Hook ============
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentCommands, setRecentCommands] = useState<string[]>([])

  const inputRef = useRef<HTMLInputElement>(null)

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
    setCurrentInterface,
    currentInterface,
    setSettingsCategory,
  } = useUIStore()

  const {
    currentChapterId,
    saveCurrentChapter,
    createChapter,
  } = useWritingStore()

  const { characters, locations } = useSettingsStore()
  const { createSession } = useChatStore()

  // 加载最近使用的命令
  useEffect(() => {
    const stored = localStorage.getItem('writer-recent-commands')
    if (stored) {
      try {
        setRecentCommands(JSON.parse(stored))
      } catch {
        // ignore
      }
    }
  }, [])

  // 保存最近使用的命令
  const recordCommand = useCallback((commandId: string) => {
    setRecentCommands((prev) => {
      const next = [commandId, ...prev.filter((id) => id !== commandId)].slice(0, 5)
      localStorage.setItem('writer-recent-commands', JSON.stringify(next))
      return next
    })
  }, [])

  // 执行AI操作
  const executeAIOperation = useCallback(
    async (operation: AIOperationType) => {
      if (!currentChapterId) {
        showToast('请先选择一个章节', 'warning')
        return
      }
      setIsOpen(false)
      const labels: Record<AIOperationType, string> = {
        optimize: '优化',
        expand: '扩写',
        condense: '缩写',
        rewrite: '改写',
        continue: '续写',
        polish: '润色',
      }
      showToast(`正在${labels[operation]}...`, 'info')
      try {
        // 实际调用会在编辑器组件中处理
        window.dispatchEvent(
          new CustomEvent('ai-operation-request', { detail: { operation } })
        )
      } catch {
        showToast('操作失败', 'error')
      }
    },
    [currentChapterId]
  )

  // 命令列表
  const commands: CommandItem[] = useMemo(() => {
    const cmds: CommandItem[] = [
      // ===== 导航 =====
      {
        id: 'goto-chat',
        label: '聊天初始化',
        shortcut: 'Ctrl+Alt+1',
        icon: <Home className="w-4 h-4" />,
        category: 'navigation',
        keywords: ['chat', 'home', '开始'],
        action: () => {
          setCurrentInterface('chat')
          showToast('已切换到聊天初始化', 'info')
          setIsOpen(false)
        },
      },
      {
        id: 'goto-settings',
        label: '设定编辑',
        shortcut: 'Ctrl+Alt+2',
        icon: <Settings className="w-4 h-4" />,
        category: 'navigation',
        keywords: ['settings', '设定', '配置'],
        action: () => {
          setCurrentInterface('settings')
          showToast('已切换到设定编辑', 'info')
          setIsOpen(false)
        },
      },
      {
        id: 'goto-writing',
        label: '正文写作',
        shortcut: 'Ctrl+Alt+3',
        icon: <PenTool className="w-4 h-4" />,
        category: 'navigation',
        keywords: ['write', '写作', '编辑'],
        action: () => {
          setCurrentInterface('writing')
          showToast('已切换到正文写作', 'info')
          setIsOpen(false)
        },
      },

      // ===== 文件 =====
      {
        id: 'save',
        label: '保存',
        shortcut: 'Ctrl+S',
        icon: <Save className="w-4 h-4" />,
        category: 'file',
        keywords: ['save', '保存'],
        action: () => {
          if (currentChapterId) {
            saveCurrentChapter()
            showToast('保存成功', 'success')
          } else {
            showToast('没有可保存的内容', 'warning')
          }
          setIsOpen(false)
        },
      },
      {
        id: 'new-chapter',
        label: '新建章节',
        shortcut: 'Ctrl+N',
        icon: <FilePlus className="w-4 h-4" />,
        category: 'file',
        keywords: ['new', 'chapter', '新建', '章节'],
        action: () => {
          createChapter({ title: '新章节', status: 'planning' })
            .then((ch) => {
              showToast(`已创建: ${ch.title}`, 'success')
            })
            .catch(() => showToast('创建失败', 'error'))
          setIsOpen(false)
        },
      },

      // ===== AI操作 =====
      {
        id: 'ai-optimize',
        label: 'AI优化',
        shortcut: 'Ctrl+Shift+O',
        icon: <Sparkles className="w-4 h-4" />,
        category: 'ai',
        keywords: ['optimize', '优化', '改进'],
        disabled: !currentChapterId || currentInterface !== 'writing',
        action: () => {
          recordCommand('ai-optimize')
          executeAIOperation('optimize')
        },
      },
      {
        id: 'ai-expand',
        label: 'AI扩写',
        shortcut: 'Ctrl+Shift+E',
        icon: <Maximize2 className="w-4 h-4" />,
        category: 'ai',
        keywords: ['expand', '扩写', '扩展'],
        disabled: !currentChapterId || currentInterface !== 'writing',
        action: () => {
          recordCommand('ai-expand')
          executeAIOperation('expand')
        },
      },
      {
        id: 'ai-condense',
        label: 'AI缩写',
        shortcut: 'Ctrl+Shift+S',
        icon: <Scissors className="w-4 h-4" />,
        category: 'ai',
        keywords: ['condense', 'shrink', '缩写', '精简'],
        disabled: !currentChapterId || currentInterface !== 'writing',
        action: () => {
          recordCommand('ai-condense')
          executeAIOperation('condense')
        },
      },
      {
        id: 'ai-rewrite',
        label: 'AI改写',
        shortcut: 'Ctrl+Shift+R',
        icon: <RefreshCw className="w-4 h-4" />,
        category: 'ai',
        keywords: ['rewrite', '改写', '重写'],
        disabled: !currentChapterId || currentInterface !== 'writing',
        action: () => {
          recordCommand('ai-rewrite')
          executeAIOperation('rewrite')
        },
      },
      {
        id: 'ai-continue',
        label: 'AI续写',
        shortcut: 'Ctrl+Shift+W',
        icon: <ArrowRight className="w-4 h-4" />,
        category: 'ai',
        keywords: ['continue', '续写', '继续'],
        disabled: !currentChapterId || currentInterface !== 'writing',
        action: () => {
          recordCommand('ai-continue')
          executeAIOperation('continue')
        },
      },
      {
        id: 'ai-polish',
        label: 'AI润色',
        shortcut: 'Ctrl+Shift+P',
        icon: <Wand2 className="w-4 h-4" />,
        category: 'ai',
        keywords: ['polish', '润色', '修饰'],
        disabled: !currentChapterId || currentInterface !== 'writing',
        action: () => {
          recordCommand('ai-polish')
          executeAIOperation('polish')
        },
      },

      // ===== 视图 =====
      {
        id: 'toggle-ai-drawer',
        label: '切换AI操作面板',
        shortcut: 'Ctrl+\\',
        icon: <MessageCircle className="w-4 h-4" />,
        category: 'view',
        keywords: ['ai', 'drawer', '面板'],
        disabled: currentInterface !== 'writing',
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
        category: 'view',
        keywords: ['collaboration', '协作', '面板'],
        disabled: currentInterface !== 'writing',
        action: () => {
          toggleCollaborationDrawer()
          setIsOpen(false)
        },
      },
      {
        id: 'toggle-outline',
        label: '切换大纲面板',
        shortcut: 'Ctrl+Shift+O',
        icon: <List className="w-4 h-4" />,
        category: 'view',
        keywords: ['outline', '大纲', '面板'],
        disabled: currentInterface !== 'writing',
        action: () => {
          toggleOutlineDrawer()
          setIsOpen(false)
        },
      },
      {
        id: 'toggle-immersive',
        label: immersiveMode ? '退出沉浸模式' : '进入沉浸模式',
        shortcut: 'Ctrl+Shift+I',
        icon: immersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />,
        category: 'view',
        keywords: ['immersive', '沉浸', '全屏'],
        disabled: currentInterface !== 'writing',
        action: () => {
          toggleImmersiveMode()
          showToast(immersiveMode ? '退出沉浸模式' : '进入沉浸模式', 'info')
          setIsOpen(false)
        },
      },
      {
        id: 'toggle-focus-mode',
        label: focusModeEnabled ? '退出专注模式' : '进入专注模式',
        shortcut: 'Ctrl+Shift+F',
        icon: focusModeEnabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
        category: 'view',
        keywords: ['focus', '专注', '模式'],
        disabled: currentInterface !== 'writing',
        action: () => {
          toggleFocusMode()
          showToast(focusModeEnabled ? '退出专注模式' : '进入专注模式', 'info')
          setIsOpen(false)
        },
      },

      // ===== 设定分类 =====
      {
        id: 'goto-world',
        label: '世界观设定',
        icon: <Globe className="w-4 h-4" />,
        category: 'settings',
        keywords: ['world', '世界观', '设定'],
        action: () => {
          setCurrentInterface('settings')
          setSettingsCategory('world')
          setIsOpen(false)
        },
      },
      {
        id: 'goto-characters',
        label: '角色设定',
        icon: <User className="w-4 h-4" />,
        category: 'settings',
        keywords: ['character', '角色', '人物'],
        action: () => {
          setCurrentInterface('settings')
          setSettingsCategory('character')
          setIsOpen(false)
        },
      },
      {
        id: 'goto-locations',
        label: '地点设定',
        icon: <MapPin className="w-4 h-4" />,
        category: 'settings',
        keywords: ['location', '地点', '场景'],
        action: () => {
          setCurrentInterface('settings')
          setSettingsCategory('location')
          setIsOpen(false)
        },
      },
      {
        id: 'goto-factions',
        label: '势力设定',
        icon: <Shield className="w-4 h-4" />,
        category: 'settings',
        keywords: ['faction', '势力', '门派'],
        action: () => {
          setCurrentInterface('settings')
          setSettingsCategory('faction')
          setIsOpen(false)
        },
      },
      {
        id: 'goto-outline',
        label: '大纲设定',
        icon: <BookOpen className="w-4 h-4" />,
        category: 'settings',
        keywords: ['outline', '大纲', '剧情'],
        action: () => {
          setCurrentInterface('settings')
          setSettingsCategory('outline')
          setIsOpen(false)
        },
      },
      {
        id: 'goto-ifline',
        label: 'IF线设定',
        icon: <GitBranch className="w-4 h-4" />,
        category: 'settings',
        keywords: ['ifline', 'IF线', '支线'],
        action: () => {
          setCurrentInterface('settings')
          setSettingsCategory('ifline')
          setIsOpen(false)
        },
      },

      // ===== 搜索实体 =====
      ...(characters.slice(0, 5).map((c) => ({
        id: `char-${c.id}`,
        label: `角色: ${c.name}`,
        icon: <User className="w-4 h-4" />,
        category: 'search' as CommandCategory,
        keywords: ['character', '角色', c.name],
        action: () => {
          setCurrentInterface('settings')
          setSettingsCategory('character')
          setIsOpen(false)
        },
      })) || []),
      ...(locations.slice(0, 3).map((l) => ({
        id: `loc-${l.id}`,
        label: `地点: ${l.name}`,
        icon: <MapPin className="w-4 h-4" />,
        category: 'search' as CommandCategory,
        keywords: ['location', '地点', l.name],
        action: () => {
          setCurrentInterface('settings')
          setSettingsCategory('location')
          setIsOpen(false)
        },
      })) || []),

      // ===== 主题 =====
      {
        id: 'toggle-theme',
        label: `切换${theme === 'dark' ? '浅色' : '深色'}模式`,
        shortcut: 'Ctrl+Shift+T',
        icon: theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
        category: 'theme',
        keywords: ['theme', '主题', '颜色'],
        action: () => {
          toggleTheme()
          showToast(`已切换至${theme === 'dark' ? '浅色' : '深色'}模式`, 'info')
          setIsOpen(false)
        },
      },

      // ===== 系统 =====
      {
        id: 'shortcuts-help',
        label: '快捷键帮助',
        shortcut: 'Ctrl+Shift+?',
        icon: <Keyboard className="w-4 h-4" />,
        category: 'system',
        keywords: ['shortcut', '快捷键', '帮助', 'help'],
        action: () => {
          window.dispatchEvent(
            new CustomEvent('show-shortcuts-help', { detail: { interface: currentInterface } })
          )
          setIsOpen(false)
        },
      },
      {
        id: 'new-chat-session',
        label: '新建聊天会话',
        icon: <MessageCircle className="w-4 h-4" />,
        category: 'system',
        keywords: ['chat', '会话', '新建'],
        action: () => {
          createSession()
          setCurrentInterface('chat')
          showToast('已创建新会话', 'success')
          setIsOpen(false)
        },
      },
    ]

    return cmds
  }, [
    currentInterface,
    currentChapterId,
    theme,
    immersiveMode,
    focusModeEnabled,
    characters,
    locations,
    toggleAIDrawer,
    toggleCollaborationDrawer,
    toggleOutlineDrawer,
    toggleTheme,
    toggleImmersiveMode,
    toggleFocusMode,
    setCurrentInterface,
    setSettingsCategory,
    saveCurrentChapter,
    createChapter,
    executeAIOperation,
    recordCommand,
    createSession,
  ])

  // 过滤命令
  const filteredCommands = useMemo(() => {
    if (!search.trim()) {
      // 无搜索时，优先显示最近使用的命令
      const recent = recentCommands
        .map((id) => commands.find((c) => c.id === id))
        .filter(Boolean) as CommandItem[]
      const others = commands.filter((c) => !recentCommands.includes(c.id))
      return [...recent, ...others].filter((c) => !c.disabled)
    }
    return commands.filter(
      (cmd) => !cmd.disabled && fuzzyMatch(search, cmd.label, cmd.keywords)
    )
  }, [commands, search, recentCommands])

  // 全局快捷键：Ctrl+K 打开/关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    // 监听自定义事件（来自ShortcutManager）
    const handleToggle = () => setIsOpen((prev) => !prev)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('toggle-command-palette', handleToggle)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('toggle-command-palette', handleToggle)
    }
  }, [])

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSelectedIndex(0)
    } else {
      setSearch('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // 键盘导航
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
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    },
    [filteredCommands, selectedIndex]
  )

  // 搜索变化时重置选中
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

/** Elegant keyboard shortcut pill */
function KbdPill({ shortcut }: { shortcut: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
      style={{
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'var(--text-tertiary)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      }}
    >
      {shortcut}
    </span>
  )
}

// ============ 组件 ============
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

  if (!isOpen) return null

  // 按分类分组
  const grouped: Record<string, CommandItem[]> = {}
  for (const cmd of filteredCommands) {
    if (!grouped[cmd.category]) grouped[cmd.category] = []
    grouped[cmd.category].push(cmd)
  }

  // 按固定顺序排列分类
  const sortedCategories = CATEGORY_ORDER.filter((cat) => grouped[cat] && grouped[cat].length > 0)

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      onClick={close}
    >
      {/* Backdrop with subtle gradient */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-xl rounded-2xl border overflow-hidden"
        style={{
          background: 'rgba(22, 22, 28, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input with glow effect */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 border-b"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="输入命令或搜索..."
            className="flex-1 bg-transparent border-none text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-0"
            style={{ color: 'var(--text-primary)' }}
          />
          <button
            onClick={close}
            className="p-1.5 rounded-md transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command list */}
        <div className="max-h-[55vh] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Feather
                  className="w-10 h-10 mx-auto mb-4"
                  style={{ color: 'var(--text-tertiary)', opacity: 0.4 }}
                />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  未找到匹配的命令
                </p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  尝试其他关键词或检查拼写
                </p>
              </motion.div>
            </div>
          ) : (
            (() => {
              let globalIndex = 0
              return sortedCategories.map((category) => (
                <div key={category}>
                  {/* Category header with accent color */}
                  <div
                    className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2"
                    style={{ color: CATEGORY_COLORS[category] }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[category] }}
                    />
                    {CATEGORY_LABELS[category as CommandCategory]}
                  </div>
                  {grouped[category].map((cmd) => {
                    const currentIndex = globalIndex++
                    const isSelected = currentIndex === selectedIndex
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => cmd.action()}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className="relative w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all duration-150 group"
                        disabled={cmd.disabled}
                        style={{
                          opacity: cmd.disabled ? 0.4 : 1,
                          cursor: cmd.disabled ? 'not-allowed' : 'pointer',
                          background: isSelected
                            ? 'linear-gradient(90deg, rgba(94, 106, 210, 0.12) 0%, rgba(94, 106, 210, 0.04) 100%)'
                            : 'transparent',
                          borderLeft: isSelected
                            ? '3px solid var(--accent-primary)'
                            : '3px solid transparent',
                        }}
                      >
                        {/* Hover gradient overlay */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                          style={{
                            background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%)',
                          }}
                        />

                        <span
                          className="relative flex-shrink-0 transition-colors duration-150"
                          style={{
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                          }}
                        >
                          {cmd.icon}
                        </span>
                        <span
                          className="relative flex-1"
                          style={{
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          {highlightMatch(search, cmd.label)}
                        </span>
                        {cmd.shortcut && (
                          <KbdPill shortcut={cmd.shortcut} />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            })()
          )}
        </div>

        {/* Footer with elegant kbd hints */}
        <div
          className="px-4 py-2.5 border-t flex items-center justify-between text-[11px]"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
            color: 'var(--text-tertiary)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <KbdPill shortcut="↑" />
              <KbdPill shortcut="↓" />
              <span className="ml-1">导航</span>
            </span>
            <span className="flex items-center gap-1">
              <KbdPill shortcut="↵" />
              <span className="ml-1">执行</span>
            </span>
            <span className="flex items-center gap-1">
              <KbdPill shortcut="Esc" />
              <span className="ml-1">关闭</span>
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Command className="w-3 h-3" />
            <span className="font-medium">K</span>
            <span style={{ opacity: 0.6 }}>打开</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )

  return createPortal(content, document.body)
}
