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
} from 'lucide-react'
import {
  getShortcutsByCategory,
  CATEGORY_LABELS,
  INTERFACE_LABELS,
  type InterfaceType,
} from '@/constants/shortcuts'

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
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]"
            >
              <div className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-[#5b8ee8]/20 flex items-center justify-center"
                >
                  <Keyboard className="w-4 h-4 text-[#5b8ee8]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#d0d6e0]">
                    快捷键参考
                  </h2>
                  <p className="text-xs text-[#8a8f98]">
                    按 <kbd className="px-1 py-0.5 rounded bg-[rgba(255,255,255,0.08)] text-[10px] font-mono">Ctrl+Shift+?</kbd> 随时打开此面板
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-[#8a8f98]" />
              </button>
            </div>

            {/* Interface Tabs */}
            <div className="flex items-center gap-1 px-6 py-3 border-b border-[rgba(255,255,255,0.06)]"
            >
              {interfaceTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveInterface(tab.key)
                    setSearchQuery('')
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeInterface === tab.key
                      ? 'bg-[#5b8ee8]/20 text-[#5b8ee8]'
                      : 'text-[#8a8f98] hover:bg-white/5 hover:text-[#d0d6e0]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <div className="flex-1" />
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索快捷键..."
                  className="w-40 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-1.5 text-xs text-[#d0d6e0] placeholder:text-[#8a8f98] focus:outline-none focus:border-[#5b8ee8]/40"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
            >
              {filteredCategories.length === 0 ? (
                <div className="text-center py-10"
                >
                  <Keyboard className="w-10 h-10 text-[#8a8f98] mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-[#8a8f98]">未找到匹配的快捷键</p>
                </div>
              ) : (
                filteredCategories.map((group) => (
                  <div key={group.category}>
                    {/* Category Header */}
                    <div className="flex items-center gap-2 mb-2.5"
                    >
                      <span className="text-[#8a8f98]">{group.icon}</span>
                      <h3 className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider"
                      >
                        {group.label}
                      </h3>
                    </div>

                    {/* Shortcuts Grid */}
                    <div className="grid grid-cols-1 gap-1.5"
                    >
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-colors group"
                        >
                          <div className="flex-1 min-w-0"
                          >
                            <div className="text-sm text-[#d0d6e0] font-medium"
                            >
                              {item.label}
                            </div>
                            <div className="text-xs text-[#8a8f98] mt-0.5"
                            >
                              {item.description}
                            </div>
                          </div>
                          <kbd className="flex-shrink-0 ml-4 px-2 py-1 rounded-md bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] text-xs font-mono text-[#d0d6e0] group-hover:border-[rgba(255,255,255,0.15)] transition-colors"
                          >
                            {item.shortcut}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between text-xs text-[#8a8f98]"
            >
              <div className="flex items-center gap-1"
              >
                <Command className="w-3 h-3" />
                <span>快捷键可在所有界面使用</span>
              </div>
              <span>
                当前界面: {INTERFACE_LABELS[activeInterface]}
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
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#8a8f98] hover:text-[#d0d6e0] hover:bg-white/5 transition-colors ${className}`}
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
