import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Keyboard,
  X,
  Navigation,
  FileText,
  Eye,
  Sparkles,
  Type,
  Settings,
  Command,
  Search,
} from 'lucide-react'
import {
  getShortcutsByCategory,
  CATEGORY_LABELS,
  INTERFACE_LABELS,
  type InterfaceType,
} from '@/constants/shortcuts'

// 分类颜色配置
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  navigation: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  file: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  view: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  ai: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  editor: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  system: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
}

// 分类图标映射
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  navigation: <Navigation className="w-4 h-4" />,
  file: <FileText className="w-4 h-4" />,
  view: <Eye className="w-4 h-4" />,
  ai: <Sparkles className="w-4 h-4" />,
  editor: <Type className="w-4 h-4" />,
  system: <Settings className="w-4 h-4" />,
}

interface ShortcutsHelpProps {
  initialInterface?: InterfaceType
}

export function ShortcutsHelp({ initialInterface = 'global' }: ShortcutsHelpProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeInterface, setActiveInterface] = useState<InterfaceType>(initialInterface)
  const [searchQuery, setSearchQuery] = useState('')

  // 监听全局事件打开帮助面板
  useEffect(() => {
    const handleShow = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.interface) {
        setActiveInterface(detail.interface)
      }
      setIsOpen(true)
    }
    window.addEventListener('show-shortcuts-help', handleShow)
    return () => window.removeEventListener('show-shortcuts-help', handleShow)
  }, [])

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // 获取当前界面的快捷键
  const shortcutsByCategory = getShortcutsByCategory(activeInterface)

  // 过滤快捷键
  const filteredCategories = Object.entries(shortcutsByCategory)
    .map(([category, items]) => ({
      category,
      label: CATEGORY_LABELS[category] || category,
      icon: CATEGORY_ICONS[category],
      items: searchQuery
        ? items.filter(
            (item) =>
              item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.shortcut.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : items,
    }))
    .filter((group) => group.items.length > 0)

  const interfaceTabs: { key: InterfaceType; label: string }[] = [
    { key: 'chat', label: '聊天' },
    { key: 'settings', label: '设定' },
    { key: 'writing', label: '写作' },
  ]

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#1a1a1e] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center border border-blue-500/20">
                  <Keyboard className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white/90">
                    快捷键参考
                  </h2>
                  <p className="text-xs text-white/40">
                    按 <kbd className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-white/60">Ctrl+Shift+?</kbd> 随时打开
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                onMouseEnter={() => document.getElementById('shortcuts-close-btn')?.classList.add('rotate-90')}
                onMouseLeave={() => document.getElementById('shortcuts-close-btn')?.classList.remove('rotate-90')}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all duration-200 group"
              >
                <X id="shortcuts-close-btn" className="w-4 h-4 text-white/50 group-hover:text-white/90 transition-all duration-200" />
              </button>
            </div>

            {/* Interface Tabs */}
            <div className="flex items-center gap-1 px-5 py-2.5 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5">
                {interfaceTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveInterface(tab.key)
                      setSearchQuery('')
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                      activeInterface === tab.key
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索快捷键..."
                  className="w-36 pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-12">
                  <Keyboard className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-white/40">未找到匹配的快捷键</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredCategories.map((group) => {
                    const colors = CATEGORY_COLORS[group.category] || { bg: 'bg-white/5', text: 'text-white/60', border: 'border-white/10' }
                    return (
                      <div key={group.category} className="relative">
                        {/* Category Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-6 h-6 rounded-md ${colors.bg} flex items-center justify-center`}>
                            <span className={colors.text}>{group.icon}</span>
                          </div>
                          <h3 className={`text-xs font-semibold ${colors.text} uppercase tracking-wider`}>
                            {group.label}
                          </h3>
                          <div className={`flex-1 h-px bg-gradient-to-r ${colors.border.replace('border', 'from')}/30 to-transparent`} />
                        </div>

                        {/* Shortcuts Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all duration-150 group"
                            >
                              <div className="flex-1 min-w-0 mr-3">
                                <div className="text-sm text-white/80 font-medium leading-tight">
                                  {item.label}
                                </div>
                                <div className="text-xs text-white/30 mt-0.5 leading-tight">
                                  {item.description}
                                </div>
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-0.5">
                                {item.shortcut.split('+').map((key, i) => (
                                  <kbd
                                    key={i}
                                    className="px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/15 text-[11px] font-mono text-white/70 shadow-[0_1px_2px_rgba(0,0,0,0.3)] group-hover:bg-white/12 group-hover:border-white/25 group-hover:text-white/90 transition-all"
                                  >
                                    {key}
                                  </kbd>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t border-white/5 flex items-center justify-between text-xs text-white/30 bg-white/[0.02]">
              <div className="flex items-center gap-1.5">
                <Command className="w-3 h-3" />
                <span>快捷键可在所有界面使用</span>
              </div>
              <span>
                当前: {INTERFACE_LABELS[activeInterface]}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(content, document.body)
}

/**
 * 快捷键帮助触发器组件
 * 可以放在工具栏或设置中
 */
export function ShortcutsHelpTrigger({ className = '' }: { className?: string }) {
  const handleClick = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('show-shortcuts-help', {
        detail: { interface: 'global' },
      })
    )
  }, [])

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition-colors ${className}`}
      title="快捷键帮助 (Ctrl+Shift+?)"
    >
      <Keyboard className="w-4 h-4" />
      <span className="hidden sm:inline">快捷键</span>
      <kbd className="hidden md:inline-flex px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[10px] font-mono">
        ?
      </kbd>
    </button>
  )
}
