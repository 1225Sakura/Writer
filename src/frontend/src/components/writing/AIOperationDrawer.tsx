import { useState } from 'react'
import { useWritingStore, WritingStyle } from '@/store'
import { getEditorInstance } from '@/store/editorRegistry'
import { showToast } from '@/components/ui/Toast'
import { ChevronDown, Feather, FileText, Edit3, Sparkles, Wand2 } from 'lucide-react'

const writingStyles: Array<{ value: WritingStyle; label: string; description: string }> = [
  { value: 'default', label: '默认', description: '标准网络小说风格' },
  { value: 'jiangnan', label: '江南', description: '细腻描写，意境悠远' },
  { value: 'kafka', label: '卡夫卡', description: '荒诞隐喻，意识流' },
  { value: 'camus', label: '加缪', description: '哲学思辨，冷峻叙事' },
  { value: 'custom', label: '自定义', description: '上传参考文本' },
]

export function AIOperationDrawer() {
  const { humanAIRatio, setHumanAIRatio, writingStyle, setWritingStyle } = useWritingStore()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['global', 'style', 'ratio', 'selection'])
  )
  const [loading, setLoading] = useState<string | null>(null)

  const handleOperation = async (operation: string) => {
    const editor = getEditorInstance()
    const selectedText = editor
      ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
      : ''

    if (!selectedText) {
      showToast('请先选中需要操作的文字', 'warning')
      return
    }

    setLoading(operation)
    console.log(`[写作操作] ${operation}:`, selectedText)

    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000))

    setLoading(null)
    showToast(`${operation}完成`, 'success')
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* 全文操作 */}
      <Section
        title="全文操作"
        icon={<FileText className="w-4 h-4" />}
        isExpanded={expandedSections.has('global')}
        onToggle={() => toggleSection('global')}
      >
        <div className="space-y-2">
          <OperationButton icon={<Feather className="w-4 h-4" />} label="生成下一章" onClick={() => showToast('正在生成下一章...', 'info')} />
          <OperationButton icon={<Sparkles className="w-4 h-4" />} label="优化全文" onClick={() => showToast('正在优化全文...', 'info')} />
          <OperationButton icon={<Wand2 className="w-4 h-4" />} label="文笔重塑" onClick={() => showToast('正在重塑文笔...', 'info')} />
        </div>
      </Section>

      {/* 人机比例 */}
      <Section
        title={`人机比例 ${humanAIRatio}%`}
        isExpanded={expandedSections.has('ratio')}
        onToggle={() => toggleSection('ratio')}
      >
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={100}
            value={humanAIRatio}
            onChange={(e) => setHumanAIRatio(Number(e.target.value))}
            className="w-full accent-[#5e6ad2]"
          />
          <div className="flex justify-between text-xs text-[#d0d6e0]">
            <span>AI主导</span>
            <span>用户主导</span>
          </div>
        </div>
      </Section>

      {/* 文笔风格 */}
      <Section
        title="文笔风格"
        icon={<Edit3 className="w-4 h-4" />}
        isExpanded={expandedSections.has('style')}
        onToggle={() => toggleSection('style')}
      >
        <div className="space-y-2">
          {writingStyles.map((style) => (
            <StyleButton
              key={style.value}
              label={style.label}
              description={style.description}
              isActive={writingStyle === style.value}
              onClick={() => setWritingStyle(style.value)}
            />
          ))}
        </div>
      </Section>

      {/* 写作操作 */}
      <Section
        title="写作操作"
        icon={<Edit3 className="w-4 h-4" />}
        isExpanded={expandedSections.has('selection')}
        onToggle={() => toggleSection('selection')}
      >
        <div className="grid grid-cols-2 gap-2">
          <OperationButton label="优化" shortcut="⌘⇧O" onClick={() => handleOperation('优化')} disabled={loading === '优化'} />
          <OperationButton label="扩写" shortcut="⌘⇧E" onClick={() => handleOperation('扩写')} disabled={loading === '扩写'} />
          <OperationButton label="缩写" shortcut="⌘⇧S" onClick={() => handleOperation('缩写')} disabled={loading === '缩写'} />
          <OperationButton label="改写" shortcut="⌘⇧R" onClick={() => handleOperation('改写')} disabled={loading === '改写'} />
          <OperationButton label="续写" shortcut="⌘⇧W" onClick={() => handleOperation('续写')} disabled={loading === '续写'} />
          <OperationButton label="润色" shortcut="⌘⇧P" onClick={() => handleOperation('润色')} disabled={loading === '润色'} />
        </div>
        <p className="text-xs text-[#d0d6e0] mt-2">
          选中文字后点击或使用快捷键
        </p>
      </Section>
    </div>
  )
}

function Section({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string
  icon?: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-[rgba(255,255,255,0.08)] rounded-lg overflow-hidden bg-[#0f1011]">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2
                   hover:bg-[rgba(255,255,255,0.04)] transition-colors"
      >
        {icon && <span className="text-[#5e6ad2]">{icon}</span>}
        <span className="flex-1 text-left text-sm font-medium text-[#f7f8f8]">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-[#d0d6e0] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      {isExpanded && <div className="p-3 bg-[#08090a]">{children}</div>}
    </div>
  )
}

function OperationButton({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
}: {
  icon?: React.ReactNode
  label: string
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-md
                 border border-[rgba(255,255,255,0.08)] hover:bg-[#0f1011]
                 active:scale-95 transition-all text-sm text-left text-[#f7f8f8]
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon && <span className="text-[#5e6ad2]">{icon}</span>}
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-[#d0d6e0]">{shortcut}</span>
      )}
    </button>
  )
}

function StyleButton({
  label,
  description,
  isActive,
  onClick,
}: {
  label: string
  description: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md border transition-all ${
        isActive
          ? 'border-[#5e6ad2] bg-[#5e6ad2] text-white'
          : 'border-[rgba(255,255,255,0.08)] hover:bg-[#0f1011] hover:border-[rgba(255,255,255,0.16)]'
      }`}
    >
      <div className="font-medium text-sm">{label}</div>
      <div className={`text-xs ${isActive ? 'text-white/80' : 'text-[#d0d6e0]'}`}>{description}</div>
    </button>
  )
}
