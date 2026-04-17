import { useState } from 'react'
import { useWritingStore, WritingStyle } from '@/store'
import { getEditorInstance } from '@/store/editorRegistry'
import { showToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { ChevronDown, Feather, FileText, Edit3, Sparkles, Wand2, Loader2 } from 'lucide-react'

const writingStyles: Array<{ value: WritingStyle; label: string; description: string }> = [
  { value: 'default', label: '默认', description: '标准网络小说风格' },
  { value: 'jiangnan', label: '江南', description: '细腻描写，意境悠远' },
  { value: 'kafka', label: '卡夫卡', description: '荒诞隐喻，意识流' },
  { value: 'camus', label: '加缪', description: '哲学思辨，冷峻叙事' },
  { value: 'custom', label: '自定义', description: '上传参考文本' },
]

export function AIOperationDrawer() {
  const {
    humanAIRatio,
    setHumanAIRatio,
    writingStyle,
    setWritingStyle,
    optimize,
    expand,
    shrink,
    rewrite,
    continue: continueWriting,
    polish,
  } = useWritingStore()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['global', 'style', 'ratio', 'selection'])
  )
  const [operationLoading, setOperationLoading] = useState<string | null>(null)

  const handleOperation = async (
    operation: 'optimize' | 'expand' | 'shrink' | 'rewrite' | 'continue' | 'polish'
  ) => {
    const editor = getEditorInstance()
    const selectedText = editor
      ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
      : ''

    if (!selectedText) {
      showToast('请先选中需要操作的文字', 'warning')
      return
    }

    setOperationLoading(operation)

    try {
      let result: string
      switch (operation) {
        case 'optimize':
          result = await optimize(selectedText)
          break
        case 'expand':
          result = await expand(selectedText)
          break
        case 'shrink':
          result = await shrink(selectedText)
          break
        case 'rewrite':
          result = await rewrite(selectedText)
          break
        case 'continue':
          result = await continueWriting(selectedText)
          break
        case 'polish':
          result = await polish(selectedText)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      // Replace selected text with result
      if (editor && result) {
        editor.commands.insertContent(result)
        showToast(`${operation}完成`, 'success')
      }
    } catch (error) {
      console.error(`[写作操作] ${operation} failed:`, error)
      showToast(`${operation}失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setOperationLoading(null)
    }
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
          <OperationButton label="优化" shortcut="⌘⇧O" onClick={() => handleOperation('optimize')} disabled={operationLoading !== null} loading={operationLoading === 'optimize'} />
          <OperationButton label="扩写" shortcut="⌘⇧E" onClick={() => handleOperation('expand')} disabled={operationLoading !== null} loading={operationLoading === 'expand'} />
          <OperationButton label="缩写" shortcut="⌘⇧S" onClick={() => handleOperation('shrink')} disabled={operationLoading !== null} loading={operationLoading === 'shrink'} />
          <OperationButton label="改写" shortcut="⌘⇧R" onClick={() => handleOperation('rewrite')} disabled={operationLoading !== null} loading={operationLoading === 'rewrite'} />
          <OperationButton label="续写" shortcut="⌘⇧W" onClick={() => handleOperation('continue')} disabled={operationLoading !== null} loading={operationLoading === 'continue'} />
          <OperationButton label="润色" shortcut="⌘⇧P" onClick={() => handleOperation('polish')} disabled={operationLoading !== null} loading={operationLoading === 'polish'} />
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
  loading,
}: {
  icon?: React.ReactNode
  label: string
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      variant="ghost"
      size="sm"
      className="w-full justify-start"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 text-[#5e6ad2] animate-spin" />
      ) : icon ? (
        <span className="text-[#5e6ad2]">{icon}</span>
      ) : null}
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-[#d0d6e0]">{shortcut}</span>
      )}
    </Button>
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
    <Button
      onClick={onClick}
      variant={isActive ? 'primary' : 'ghost'}
      size="sm"
      className="w-full justify-start"
    >
      <div className="font-medium text-sm">{label}</div>
      <div className={`text-xs ${isActive ? 'text-white/80' : 'text-[#d0d6e0]'}`}>{description}</div>
    </Button>
  )
}
